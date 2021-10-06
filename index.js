"use strict";
const Fastify = require("fastify");
// Node.js require:
const Ajv7 = require("ajv")
const ajv = new Ajv7() // options can be passed, e.g. {allErrors: true}
const addFormats = require("ajv-formats")
addFormats(ajv)
const nodeOptionsSchema = require("./node-schema.json")
const nodeOptionsSchemaValidate = ajv.compile(nodeOptionsSchema);
const nodeServiceOptionsSchema = require("./service-schema.json")
const nodeServiceOptionsSchemaValidate = ajv.compile(nodeServiceOptionsSchema);
const path = require("path");
const activeNodes = new Set();
function clone(object) {
    return JSON.parse(JSON.stringify(object));

}
const util = require("./lib/util");

class MicroServiceNode {
    constructor(json_config, baseDir) {
        //if pass json string then parse and replace envs first
        const config_object = typeof(json_config) == "string"? JSON.parse(util.replaceByEnv(json_config)):json_config
        const valid = nodeOptionsSchemaValidate(config_object)
        if (!valid) {
            const errors = nodeOptionsSchemaValidate.errors
            throw new Error(
                `Invalid mservice-node options:\n\t${errors.map(schemaError => {
                    return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
                }).join("\n================================================================================")}\n\n`);
        }
        const config = Object.freeze(config_object); //options can not change
        Object.defineProperty(this, 'config', { get: () => config });
        const fastify = Fastify(config.fastify != null ? config.fastify.options : null);
        Object.defineProperty(this, 'fastify', { get: () => fastify });
        const log = require('pino')({ level: config.logger.level, base: { pid: process.pid, service_node: "core" } });
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        const services = new Set();
        Object.defineProperty(this, 'services', { get: () => services, enumerable: true });
        for (const serviceName of Object.keys(config.services)) {
            if (config.services[serviceName].active !== true) continue; //ignore in active service
            const serviceconfig = Object.freeze(require(baseDir + config.services[serviceName].config));
            const servicePath = path.dirname(require.resolve(baseDir + config.services[serviceName].config));
            services.add(new NodeService(serviceName, serviceconfig, servicePath));
        }
        const authentication_config = {};

        if (config.authentication != null) {
            for (const authType of Object.keys(config.authentication)) {
                switch (authType) {
                    case "bearer":
                        const bearer_config = clone(config.authentication[authType]);
                        authentication_config.bearer = bearer_config;
                        break;
                }
            }
        }
        const schemas = []
        if (config.schema != null) {
            const schema_config = clone(config.schema);
            if (schema_config.use_basic === true) {
                const base_service_schema = require(__dirname + "/basic-schema_for_route.json");
                fastify.addSchema(base_service_schema);
                schemas.push(base_service_schema)
            }
            delete schema_config.use_basic;
            if (schema_config.config != null) {
                for (const [a_schema_name, a_schema_config_path] of Object.entries(schema_config.config)) {
                    const a_schema = require(baseDir + a_schema_config_path);
                    fastify.addSchema(a_schema);
                    schemas.push(a_schema)
                }
            }
        }

        if (config.swagger != null) {
            const swagger = require("fastify-swagger");
            const swagger_config = clone(config.swagger);
            const routePrefix = swagger_config.routePrefix;
            delete swagger_config.routePrefix;
            fastify.register(swagger, {
                routePrefix: routePrefix,
                openapi: swagger_config,
                uiConfig: {
                    docExpansion: 'full',
                    deepLinking: false
                },
                staticCSP: true,
                transformStaticCSP: (header) => header,
                exposeRoute: true,
                refResolver: {
                    clone: true, // Clone the input schema without changing it. Default: false
                    applicationUri: 'my-application.org', // You need to provide an unique URI to resolve relative `$id`s
                    externalSchemas: schemas // The schemas provided at the creation of the resolver, will be used evvery time `.resolve` will be called
                }
            });
            fastify.ready(err => {
                if (err) throw err
                fastify.swagger()
            })

        }
        Object.defineProperty(this, 'authentication_config', { get: () => authentication_config, enumerable: false });
        Object.defineProperty(this, 'baseDir', { get: () => baseDir, enumerable: true });
        Object.defineProperty(this, 'name', { get: () => config.node.name, enumerable: true });
        log.info(`Load node options successfully.`);
    }
    async start() {
        this.log.info(`Start node.`);
        // start all servicee
        this.log.debug({ services_size: this.services.size });
        for (const service of this.services) {
            this.log.debug({ start_service: service.config.service.baseURL });
            await service.start(this.fastify, this.authentication_config);
        }
        this.log.info(`Start all service.`);
        await this.fastify.ready();
        this.log.info(`fastiy ready.`);
        await this.fastify.listen(this.config.node.port, this.config.node.listen);
        activeNodes.add(this);// add after start successfully
        this.log.info(`Start node successfully.`);
    }

    async close() {
        this.log.info(`closing '${this.name}' node and it's services.`);
        const serviceClosePromises = [];
        for (const service of this.services) {
            serviceClosePromises.push(service.close())
        }
        await Promise.all(serviceClosePromises);
        await this.fastify.close();//close fastify last
    }
}

class NodeService {
    constructor(serviceName, config_object, servicePath) {
        const valid = nodeServiceOptionsSchemaValidate(config_object)
        if (!valid) {
            const errors = nodeServiceOptionsSchemaValidate.errors;
            throw new Error(
                `Invalid node-service '${serviceName}' options:\n\t${errors.map(schemaError => {
                    return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
                }).join("\n================================================================================")}\n\n`);
        }
        const config = config_object;
        Object.defineProperty(this, 'config', { get: () => config });
        const log_base = { pid: process.pid, service: `${serviceName}` };
        const log = require('pino')({ level: this.config.service.logger.level, base: log_base });
        log.debug({ config: this.config })
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        const _handlers = new Set();
        Object.defineProperty(this, '_handlers', { get: () => _handlers, enumerable: false });
        const name = serviceName;
        Object.defineProperty(this, 'name', { get: () => name, enumerable: true });
        const path = servicePath;
        Object.defineProperty(this, 'path', { get: () => path, enumerable: true });

    }
    async start(fastify, node_authentication_config) {
        const serviceInstance = this;
        const error = {};
        fastify.register(async (fastifyServiceContext) => {
            try {
                const service_handler_config = JSON.parse(JSON.stringify(this.config)); //copy config
                //merge both
                const authentication_config = { ...(node_authentication_config != null ? node_authentication_config : {}), ...service_handler_config.service.authentication != null ? service_handler_config.service.authentication : {} };
                for (const authType of Object.keys(authentication_config)) {
                    switch (authType) {
                        case "bearer":
                            const bearerAuthPlugin = require('fastify-bearer-auth');
                            const bearer_config = authentication_config[authType];
                            //bearer_config["addHook"] = false; //so can be override by service
                            //register to service level fastify not root
                            fastifyServiceContext.register(bearerAuthPlugin, bearer_config);
                            break;
                    }
                }
                delete service_handler_config.service;//remove service config since it use for service only
                Object.freeze(service_handler_config);// freeze config
                serviceInstance.log.debug({ routes: serviceInstance.config.service.routes })
                for (const orgRoute of serviceInstance.config.service.routes) {
                    const route = JSON.parse(JSON.stringify(orgRoute));//copy since we gonna change it
                    serviceInstance.log.debug({ route });
                    route.url = "/" + serviceInstance.config.service.baseURL + route.url
                    const funcName = route.handler.function;
                    const handler_path = serviceInstance.path + "/" + route.handler.file;
                    const obj_handler = require(handler_path);
                    if (!obj_handler instanceof NodeServiceHandler) {
                        throw new Error(` ${serviceInstance.name}'s handler must be instance of ServiceHandler`);
                    }
                    serviceInstance._handlers.add(obj_handler);
                    if (typeof (obj_handler[funcName]) !== 'function') {
                        throw new Error(` ${serviceInstance.name}'s handler function for route:${route.url} is not a function`);
                    }
                    serviceInstance.log.debug("Load function successfully");
                    route.handler = obj_handler[funcName];
                    await obj_handler.init(service_handler_config, serviceInstance.log);
                    await fastifyServiceContext.route(route);
                    serviceInstance.log.debug({ service: serviceInstance.name, route: route.url, status: "initialized" })
                }
            } catch (fastifyRegisterError) {
                serviceInstance.log.error({ error: `error while in fastify register`, stack: fastifyRegisterError.stack });
                error.fastifyRegisterError = fastifyRegisterError;
            }
        });
        await fastify.after(); //make sure all plug in loaded after register
        if (error.fastifyRegisterError) throw error.fastifyRegisterError;
        this.log.info(`start service successfully.`);
    }
    async close() {
        this.log.info(`closing '${this.name}' service and it's handlers.`)
        const handlerClosePromises = [];
        for (const handler of this._handlers) {
            handlerClosePromises.push(handler.close(this.log))
        }
        return Promise.all(handlerClosePromises);
    }
}
const NodeServiceHandler = require("./ServiceHandler");

/**
 * shut down properly
 */
const errorTypes = ['unhandledRejection', 'uncaughtException']
const signalTraps = ['SIGTERM', 'SIGINT', 'SIGUSR2']

let isUnhandledRejectionLoop = false;
errorTypes.map(type => {
    process.on(type, async error => {
        try {
            if (isUnhandledRejectionLoop) {
                console.error(type, "is looped");
                process.exit(1);
            }
            isUnhandledRejectionLoop = true;
            console.error(`${type}.\nerror: ${error.message}\nstack: ${error.stack}`);
            console.log(`clean resounce on ${type}`)

            const nodeClosePromises = [];
            for (const node of activeNodes) {
                nodeClosePromises.push(node.close())
            }
            await Promise.all(nodeClosePromises);
            console.log(`clean all nodes successfully`)
        } catch (_) {
            process.exit(1);
        } finally {
            process.exit(1);
        }
    })
})

signalTraps.map(type => {
    process.on(type, async () => {
        try {
            console.log(`clean resounce on ${type}`)
            const nodeClosePromises = [];
            for (const node of activeNodes) {
                nodeClosePromises.push(node.close())
            }
            await Promise.all(nodeClosePromises);
        } catch (err) {
            console.error(`error while try to close process.\nerror: ${error.message}\nstack: ${error.stack}`);
            process.exit(1);
        } finally {
            process.exit(0);
        }
    })
})
module.exports = {
    mserviceNode:
        (options, baseDir) => {
            return new MicroServiceNode(options, baseDir)
        },
    ServiceHandler: NodeServiceHandler
};