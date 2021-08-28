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
        log.info(`Load node options successfully.`);
        for (const serviceName of Object.keys(config.services)) {
            const serviceConfig = require(baseDir + config.services[serviceName].config);
            const servicePath = path.dirname(require.resolve(baseDir + config.services[serviceName].config));
            new NodeService(serviceName, serviceConfig, fastify, servicePath);
        }
    }
    async start() {
        // Declare a route
        this.fastify.get('/', async (request, reply) => {
            return { hello: 'world' }
        });
        await this.fastify.listen(3000);
    }
}
class NodeService {
    constructor(serviceName, config_object, fastify, baseDir) {
        const valid = nodeServiceOptionsSchemaValidate(config_object)
        if (!valid) throw new Error(
            `Invalid node-service '${serviceName}' options:\n\t${nodeServiceOptionsSchemaValidate.errors.map(schemaError => {
                return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
            }).join("\n================================================================================")}\n\n`);
        const config = Object.freeze(config_object); //options can not change
        Object.defineProperty(this, 'config', { get: () => config });
        const log_base = { pid: process.pid };
        log_base[`${serviceName}_service`]
        const log = require('pino')({ level: config.service.logger.level, base: log_base });
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        const _handlers = [];
        Object.defineProperty(this, '_handlers', { get: () => _handlers, enumerable: false });
        fastify.register(async (fastifyServiceContext) => {
            //register plugins of this service
            // if (config.service.cache != null) {
            //     const fastifyCaching = require("fastify-caching");
            //     if ((config.service.cache.privacy != null) && (Object.values(fastifyCaching.privacy).indexOf(config.service.cache.privacy) < 0)) {
            //         throw new Error(`invalid cache privacy value in service config of ${service}`)
            //     }
            //     fastifyServiceContext.register(
            //         fastifyCaching,
            //         config.service.cache)
            // }
            for (const route of config.service.routes) {
                route.url = "/" + config.service.baseURL + route.url
                log.debug({ service: serviceName, route: route.url })
                const funcName = route.handler.function;
                const obj_handler = require(baseDir + "/" + route.handler.file);
                _handlers.push(obj_handler)
                if (!obj_handler instanceof NodeServiceHandler) {
                    throw new Error(` ${serviceName}'s handler must be instance of ServiceHandler`);
                }
                if (typeof (obj_handler[funcName]) !== 'function') {
                    throw new Error(` ${serviceName}'s handler function for route:${route.url} is not a function`);
                }
                route.handler = obj_handler[funcName];
                await obj_handler.init(log);
                fastifyServiceContext.route(route);
            }
        });
        log.info(`Load "${serviceName}" service's options successfully.`);
    }
    async close() {
        for (const handler of this._handlers) {
            await handler.close();
        }
    }
}
const NodeServiceHandler = require("./ServiceHandler");
module.exports = {
    mserviceNode:
        (options, baseDir) => {
            return new MicroServiceNode(options, baseDir)
        },
    nodeService:
        (service_options) => {
            return new NodeService(service_options);
        },
    serviceHandler: NodeServiceHandler
};