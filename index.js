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
const fs = require("fs");

class MicroServiceNode {
    constructor(json_config, baseDir) {
        //if pass json string then parse and replace envs first
        const config_object = typeof (json_config) == "string" ? JSON.parse(util.replaceByEnv(json_config)) : json_config
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
            const serviceconfig_string = fs.readFileSync(baseDir + config.services[serviceName].config, { encoding: 'utf8', flag: 'r' });
            const serviceconfig = JSON.parse(util.replaceByEnv(serviceconfig_string));//not freeze on service config up to service to freeze it
            const servicePath = path.dirname(require.resolve(baseDir + config.services[serviceName].config));
            services.add(new NodeService(serviceName, serviceconfig, servicePath));
        }
        const authentication_config = config.authentication != null ? clone(config.authentication) : {};

        Object.defineProperty(this, 'authentication_config', { get: () => authentication_config, enumerable: false });
        Object.defineProperty(this, 'baseDir', { get: () => baseDir, enumerable: true });
        Object.defineProperty(this, 'name', { get: () => config.node.name, enumerable: true });
        log.info(`Load node options successfully.`);
    }
    /**
     * start node
     */
    async start() {
        //register all fastify's plug in here
        const fastify = this.fastify;
        this.log.info(`Start node.`);
        // start all servicee
        this.log.debug({ services_size: this.services.size });
        const dbServices = [];
        if (this.config.database != null) {
            const dbs = Object.keys(this.config.database);
            for (const db of dbs) {
                switch (db) {
                    case "mysql":
                        const mysql_config_object = clone(this.config.database.mysql);
                        if (mysql_config_object.pool.ssl.ca != null) {
                            mysql_config_object.pool.ssl.ca = fs.readFileSync(this.baseDir + mysql_config_object.pool.ssl.ca);
                        }
                        const { MySQLDatabaseService } = new require("./DatabaseService");
                        const mysql = new MySQLDatabaseService(mysql_config_object);
                        await mysql.start();
                        dbServices.push(mysql);
                        this.log.info({ mysql: "mysql start successfully" });
                        break;
                }
            }
        }
        const serviceStartPromises = [];
        const schemas = []
        if (this.config.schema != null) {
            const schema_config = clone(this.config.schema);
            if (schema_config.use_basic === true) {
                const base_service_schema = require(__dirname + "/basic-schema_for_route.json");
                //fastify.addSchema(base_service_schema);
                schemas.push(base_service_schema)
            }
            delete schema_config.use_basic;
            if (schema_config.config != null) {
                for (const [a_schema_name, a_schema_config_path] of Object.entries(schema_config.config)) {
                    const a_schema = require(this.baseDir + a_schema_config_path);
                    //fastify.addSchema(a_schema);
                    schemas.push(a_schema)
                }
            }
        }
        if (this.config.swagger != null) {
            const swagger = require("@fastify/swagger");
            const swagger_config = clone(this.config.swagger);
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
                    applicationUri: 'my-application.org' // You need to provide an unique URI to resolve relative `$id`s
                    //externalSchemas: schemas // The schemas provided at the creation of the resolver, will be used evvery time `.resolve` will be called
                }
            });
            fastify.ready(err => {
                if (err) throw err
                fastify.swagger()
            })

        }
        await fastify.after();
        for (const service of this.services) {
            this.log.debug({ start_service: service.config.service.baseURL });
            await service.start(this.fastify, this.authentication_config, dbServices);
        }
        await Promise.all(serviceStartPromises);
        if (this.config.cors != null) {
            fastify.register(require("@fastify/cors"), this.config.cors);
            this.log.info(`support cors on ${this.config.cors.origin}`);
            await fastify.after();
        }

        this.log.info(`Start all service.`);
        await fastify.ready();
        this.log.debug(`fastiy ready.`);
        await fastify.listen(this.config.node.port, this.config.node.listen);
        activeNodes.add(this);// add after start successfully
        this.log.info(`Start node successfully.`);
    }

    async close() {
        try {
            this.log.info(`closing '${this.name}' node and it's services.`);
            const serviceClosePromises = [];
            for (const service of this.services) {
                serviceClosePromises.push(service.close())
            }
            await Promise.all(serviceClosePromises);
        } finally {
            await this.fastify.close();
        }
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
    async start(fastify, node_authentication_config, dbServices) {
        const serviceInstance = this;
        const databaseService = dbServices;
        const error = {};

        fastify.register(async (fastifyServiceContext) => {
            try {
                const service_handler_config = JSON.parse(JSON.stringify(serviceInstance.config)); //copy config
                //merge both, same auth will be replaced by service level
                const authentication_config = { ...(node_authentication_config != null ? node_authentication_config : {}), ...service_handler_config.service.authentication != null ? service_handler_config.service.authentication : {} };
                const auth_verify_functions = [];
                for (const authType of Object.keys(authentication_config)) {
                    switch (authType) {
                        case "bearer":
                            const bearer_config = authentication_config[authType];
                            if (bearer_config == null) break;
                            const bearerAuthPlugin = require('@fastify/bearer-auth');
                            bearer_config["addHook"] = false; //so can be override by service
                            //register to service level fastify not root
                            fastifyServiceContext.register(bearerAuthPlugin, bearer_config);
                            await fastifyServiceContext.after();//wait for register to complete first before add 
                            auth_verify_functions.push(fastifyServiceContext.verifyBearerAuth);
                            break;
                        case "jwt":
                            const jwt_config = authentication_config[authType];
                            if (jwt_config == null) break;
                            const jwt_options = {
                                secret: {
                                    private: Buffer.from(jwt_config.secret.private_base64, 'base64').toString('utf8'),
                                    public: Buffer.from(jwt_config.secret.public_base64, 'base64').toString('utf8')
                                }
                            }
                            if (jwt_config.sign != null) {
                                jwt_options.sign = jwt_config.sign;
                            }
                            if (jwt_config.verify != null) {
                                jwt_options.verify = jwt_config.verify;
                            }
                            fastifyServiceContext.register(require("@fastify/jwt"), jwt_options);
                            await fastifyServiceContext.after();//wait for register to complete first before add 
                            fastifyServiceContext.decorate("verifyJWT", async function (request, reply) {
                                await request.jwtVerify();
                            });
                            auth_verify_functions.push(fastifyServiceContext.verifyJWT);
                            break;
                    }
                }

                //register as hook so it affect while service (all routes below)
                if (auth_verify_functions.length > 0) {
                    fastifyServiceContext.register(require('@fastify/auth'));
                    await fastifyServiceContext.after();
                    fastifyServiceContext.addHook('preHandler', fastifyServiceContext.auth(auth_verify_functions))
                }
                delete service_handler_config.service.routes;//remove service config since it use for fastify service only
                //Object.freeze(service_handler_config);// freeze config
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
                    await obj_handler.init(service_handler_config, serviceInstance.log, databaseService);
                    await fastifyServiceContext.route(route);
                    serviceInstance.log.debug({ service: serviceInstance.name, route: route.url, status: "initialized" })
                }
                await fastifyServiceContext.after();
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
const { config } = require("process");

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
const { MySQLDatabaseService } = require("./DatabaseService");
module.exports = {
    mserviceNode:
        (options, baseDir) => {
            return new MicroServiceNode(options, baseDir)
        },
    ServiceHandler: NodeServiceHandler,
    MySQLDatabaseService,
    util
};