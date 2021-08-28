
const nodeConfig = {
    "node": {
        "name": "demo",
        "host": "localhost",
        "listen": "0.0.0.0",
        "port": 2000
    },
    "services": {
        "Home": {
            "note": "the service note",
            "config": "/home/setting.json",
            "url": "http://localhost",
            "active": true
        }
    },
    "logger": {
        "level": "debug"
    }
};
const { mserviceNode } = require("../index");
const got = require("got");
const client = got.extend({
    prefixUrl: `http:${nodeConfig.node.host}:${nodeConfig.node.port}`
})
const activeNodes = new Set();
function clone(config) {
    return JSON.parse(JSON.stringify(config))
}
test("start a node with minimal config", async () => {
    const msnode = mserviceNode(nodeConfig, __dirname);
    activeNodes.add(msnode);
    await msnode.start();
    const response = await client.get(`home/`);
    expect(response.body).toEqual("hi");
}, 5000);

test("call unknown route", async () => {
    const msnode = mserviceNode(nodeConfig, __dirname);
    activeNodes.add(msnode);
    await msnode.start();
    try {
        await client.get(`unknown/`);
    } catch (error) {
        expect(error.response.statusCode).toEqual(404);
    }
}, 5000);
const basicService = {
    "config": "/basic/setting.json",
    "url": "http://localhost",
    "active": true
}
test("handler have only a instance event reference by multiple router, init only once", async () => {
    const config = clone(nodeConfig);
    config.services["Basic"] = basicService;
    const msnode = mserviceNode(config, __dirname);
    await msnode.start();
    activeNodes.add(msnode);
    const response = await client.get(`basic/`);
    expect(response.body).toEqual("hi");
    expect(msnode.services.size).toEqual(2);
    for (const service of msnode.services) {
        //handler have only one even
        expect(service._handlers.size).toEqual(1);
        for (const handler of service._handlers)
            if (handler.initCounter != null)
                expect(handler.initCounter.counter).toEqual(1);
    }
}, 5000);

afterEach(async () => {
    for (const node of activeNodes) {
        await node.close();
    }
})