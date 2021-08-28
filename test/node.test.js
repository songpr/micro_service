
const nodeConfig = {
    "node": {
        "name": "demo",
        "host": "localhost",
        "listen": "0.0.0.0",
        "port": 2000
    },
    "services": {
        "home": {
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

afterEach(async () => {
    for (const node of activeNodes) {
        await node.close();
    }
})