const fs = require("fs");
const setting = fs.readFileSync(__dirname + "/setting.json", { encoding: 'utf8', flag: 'r' });
const { mserviceNode } = require("../index");
const util = require("../lib/util");
const replace_config = util.replaceByEnv(setting);

const start = async () => {
    const msnode = mserviceNode(JSON.parse(replace_config), __dirname);
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
