const setting = require("./setting.json");
const { mserviceNode } = require("../index");

const start = async () => {
    const msnode = mserviceNode(setting, __dirname);
    await msnode.start();
}
start()
    .then(() => {
        console.log("start sucessfully");
    })
    .catch(err => {
        console.log(`error:${err.message}\nstack:${err.stack}`);
        process.exit(1);
    });
