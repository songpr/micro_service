const handler = new (require('../../ServiceHandler'))();

async function init(service_log) {
    service_log.info(this.config)
}
const hi = async (request, reply) => {
    reply.send("hi")
}
function close(service_log) {
    service_log.info(`close home hanlder`)
}

handler.hi = hi;
handler.initHandler = init;
handler.closeHanler = close;
module.exports = handler;