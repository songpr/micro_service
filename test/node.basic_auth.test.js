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
    "authentication_note": "node authentication, each property is a auth method order by setting. auth can be overrided by service authentication",
    "authentication": {
        "bearer": {
            "keys": [
                "KBgh4msyuKP8qezFZZA6QhW3WjqH7mmzbctGW3YnN6eVtecBhWbrtLGqXBtQdqyw",
                "ZZVdbXF4gUbY8mQjNGqoy7p2KY2FZffGFDAKpcZcdFbztedbntkv7rjbKQrooJrG"
            ]
        }
    },
    "logger": {
        "level": "debug"
    }
};
const { mserviceNode } = require("../index");
const got = require("got");
const clientKey0 = got.extend({
    prefixUrl: `http:${nodeConfig.node.host}:${nodeConfig.node.port}`,
    headers: {
        Authorization: `Bearer ${nodeConfig.authentication.bearer.keys[0]}`
    }
})
const clientKey1 = got.extend({
    prefixUrl: `http:${nodeConfig.node.host}:${nodeConfig.node.port}`,
    headers: {
        Authorization: `Bearer ${nodeConfig.authentication.bearer.keys[0]}`
    }
})

const clientHomeKey = got.extend({
    prefixUrl: `http:${nodeConfig.node.host}:${nodeConfig.node.port}`,
    headers: {
        Authorization: `Bearer BdqXeK2XfGCnY4WGPkMnfiLmX4psnWxKHXJPqyUeBnrKNNAtJU4u4r8qwqCmFb3T`
    }
})
const activeNodes = new Set();
function clone(config) {
    return JSON.parse(JSON.stringify(config))
}
test("requests of node must be authticated", async () => {
    const msnode = mserviceNode(nodeConfig, __dirname);
    activeNodes.add(msnode);
    await msnode.start();
    try {
        await got.get(`http:${nodeConfig.node.host}:${nodeConfig.node.port}/home/`);
        fail('it should be failed');
    } catch (error) {
        expect(error.response.statusCode).toEqual(401);
    }
    const responseKey0 = await clientKey0.get(`home/`);
    expect(responseKey0.body).toEqual("hi");
    const responseKey1 = await clientKey1.get(`home/`);
    expect(responseKey1.body).toEqual("hi");
}, 5000);
const homeBasicAuth = {
    "config": "/home_basic_auth/setting.json",
    "url": "http://localhost",
    "active": true
}
test("service level auth override same auth type at node level auth", async () => {
    const config = clone(nodeConfig);
    config.services["HomeBasicAuth"] = homeBasicAuth;
    const msnode = mserviceNode(config, __dirname);
    activeNodes.add(msnode);
    await msnode.start();
    try {
        await got.get(`http:${nodeConfig.node.host}:${nodeConfig.node.port}/home_basic_auth/`)
        fail('it should be failed');
    } catch (error) {
        expect(error.response.statusCode).toEqual(401);
    }
    const responseHomeKey = await clientHomeKey.get(`home_basic_auth/`);
    expect(responseHomeKey.body).toEqual("hi");
}, 5000);

afterEach(async () => {
    for (const node of activeNodes) {
        await node.close();
    }
})