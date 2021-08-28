const setting = require("./setting.json");
const msNode = require("../index")(setting);

const start = async () => {
    await msNode.start();
}
start()
.then(()=>{
    console.log("start sucessfully");
})
.catch(err=>{
    console.log(`error:${err.message}\nstack:${err.stack}`);
})
