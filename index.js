"use strict";
const Fastify = require("fastify");
// Node.js require:
const Ajv7 = require("ajv")
const ajv = new Ajv7() // options can be passed, e.g. {allErrors: true}
const nodeOptionsSchema = require("./node-schema.json")
const nodeOptionsSchemaValidate = ajv.compile(nodeOptionsSchema);
const nodeServiceOptionsSchema = require("./service-schema.json")
const nodeServiceOptionsSchemaValidate = ajv.compile(nodeServiceOptionsSchema);
const path = require("path");
const activeNodes = new Set();
class MicroServiceNode {
    constructor(config_object, baseDir) {
        const valid = nodeOptionsSchemaValidate(config_object)
        if (!valid) throw new Error(
            `Invalid mservice-node options:\n\t${nodeOptionsSchemaValidate.errors.map(schemaError => {
                return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
            }).join("\n================================================================================")}\n\n`);
        const config = Object.freeze(config_object); //options can not change
        Object.defineProperty(this, 'config', { get: () => config });
        const fastify = Fastify(config.fastify.options)
        Object.defineProperty(this, 'fastify', { get: () => fastify });
        const log = require('pino')({ level: config.logger.level, base: { pid: process.pid, mserice_node: "core" } });
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        const services = new Set();
        Object.defineProperty(this, 'services', { get: () => services, enumerable: true });
        for (const serviceName of Object.keys(config.services)) {
            if (config.services[serviceName].active !== true) continue; //ignore in active service
            const serviceconfig = require(baseDir + config.services[serviceName].config);
            const servicePath = path.dirname(require.resolve(baseDir + config.services[serviceName].config));
            services.add(new NodeService(serviceName, serviceconfig, fastify, servicePath));
        }
        Object.defineProperty(this, 'baseDir', { get: () => baseDir, enumerable: true });
        log.info(`Load node options successfully.`);
    }
    async start() {
        // start all service
        for (const service of this.services) {
            await service.start(this.fastify)
        }
        await this.fastify.listen(3000);
        activeNodes.add(this);// add after start successfully
        this.log.info(`Start node successfully.`);
    }

    async close() {
        const serviceClosePromises = [];
        for (const service of this.services) {
            serviceClosePromises.push(service.close())
        }
        return Promise.all(serviceClosePromises);
    }
}
class NodeService {
    constructor(serviceName, config_object, servicePath) {
        const valid = nodeServiceOptionsSchemaValidate(this.config_object)
        if (!valid) throw new Error(
            `Invalid node-service '${serviceName}' options:\n\t${nodeServiceOptionsSchemaValidate.errors.map(schemaError => {
                return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
            }).join("\n================================================================================")}\n\n`);
        const config = Object.freeze(config_object); //options can not change
        Object.defineProperty(this, 'config', { get: () => config });
        const log_base = { pid: process.pid };
        log_base[`${serviceName}_service`]
        const log = require('pino')({ level: this.config.service.logger.level, base: log_base });
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        const _handlers = new Set();
        Object.defineProperty(this, '_handlers', { get: () => _handlers, enumerable: false });
        Object.defineProperty(this, 'name', { get: () => serviceName, enumerable: true });
        Object.defineProperty(this, 'servicePath', { get: () => servicePath, enumerable: true });

    }
    async start(fastify) {
        fastify.register(async (fastifyServiceContext) => {
            //register plugins of this service
            // if (this.config.service.cache != null) {
            //     const fastifyCaching = require("fastify-caching");
            //     if ((this.config.service.cache.privacy != null) && (Object.values(fastifyCaching.privacy).indexOf(this.config.service.cache.privacy) < 0)) {
            //         throw new Error(`invalid cache privacy value in service this.config of ${service}`)
            //     }
            //     fastifyServiceContext.register(
            //         fastifyCaching,
            //         this.config.service.cache)
            // }
            const service_handler_config = JSON.parse(JSON.stringify(this.config)); //copy config
            delete service_handler_config.service;//remove service config since it use for service only
            Object.freeze(service_handler_config);// freeze config
            for (const route of this.config.service.routes) {
                route.url = "/" + this.config.service.baseURL + route.url

                const funcName = route.handler.function;
                const obj_handler = require(this.servicePath + "/" + route.handler.file);
                _handlers.add(obj_handler);
                if (!obj_handler instanceof NodeServiceHandler) {
                    throw new Error(` ${this.name}'s handler must be instance of ServiceHandler`);
                }
                if (typeof (obj_handler[funcName]) !== 'function') {
                    throw new Error(` ${this.name}'s handler function for route:${route.url} is not a function`);
                }
                route.handler = obj_handler[funcName];
                await obj_handler.init(service_handler_config, this.log);
                fastifyServiceContext.route(route);
                this.log.debug({ service: this.name, route: route.url, status: "initialized" })
            }
        });
        this.log.info(`Load '${this.name}' service's options successfully.`);
    }
    async close() {
        this.log.info(`closing '${this.name}' service and it's handlers.`)
        const handlerClosePromises = [];
        for (const handler of this._handlers) {
            handlerClosePromises.push(handler.close())
        }
        return Promise.all(serviceClosePromises);
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
    process.on(type, async e => {
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
    nodeService:
        (service_options) => {
            return new NodeService(service_options);
        },
    ServiceHandler: NodeServiceHandler
};