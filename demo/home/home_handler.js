const { ServiceHandler } = require('../../index');
const handler = new ServiceHandler();

async function init(service_log) {
    service_log.info({ home_handler_config: this.config })
}
const hi = async (request, reply) => {
    const name = request.params != null && request.params.name != null ? request.params.name : null;
    if(name == "error"){
        throw new Error("Error")
    }
    reply.send(`hi${name != null ? ` ${name}` : ""}`)
}
function close(service_log) {
    service_log.info(`close home hanlder`)
}

handler.hi = hi;
handler.hiUser = hi;
handler.initHandler = init;
handler.closeHandler = close;
module.exports = handler;