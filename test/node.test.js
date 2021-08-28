
const nodeConfig = {
    "node": {
        "name": "demo",
        "host": "localhost",
        "listen": "0.0.0.0",
        "port": 5555
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
const { mserviceNode } = require("../index")
test("start a node with minimal config", async () => {
    const msnode = mserviceNode(nodeConfig, __dirname);
    await msnode.start();
    await msnode.close();
}, 5000);