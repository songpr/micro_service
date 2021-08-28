"use strict";
const Fastify = require("fastify");
// Node.js require:
const Ajv7 = require("ajv")
const ajv = new Ajv7() // options can be passed, e.g. {allErrors: true}
const nodeOptionsSchema = require("./node-schema.json")
const nodeOptionsSchemaValidate = ajv.compile(nodeOptionsSchema);

class MicroServiceNode {
    constructor(config_object) {
        const valid = nodeOptionsSchemaValidate(config_object)
        if (!valid) throw new Error(
            `Invalid mservice-node options:\n\t${nodeOptionsSchemaValidate.errors.map(schemaError => {
                return `error at: ${schemaError.instancePath}\n\terror: ${schemaError.message}`
            }).join("\n================================================================================")}\n\n`);
        const config = Object.freeze(config_object); //options can not change
        Object.defineProperty(this, 'config', { get: () => config });
        const fastify = Fastify(config.fastify.options)
        Object.defineProperty(this, 'fastify', { get: () => fastify });
        const log = require('pino')({ level: (config.logger.level || "info"), base: { pid: process.pid, mserice_node: "core" } });
        Object.defineProperty(this, 'log', { get: () => log, enumerable: true });
        log.info(`Load options successfully.`)
    }
    async start() {
        // Declare a route
        this.fastify.get('/', async (request, reply) => {
            return { hello: 'world' }
        });
        await this.fastify.listen(3000);
    }
}
module.exports = (options) => {
    return new MicroServiceNode(options)
};