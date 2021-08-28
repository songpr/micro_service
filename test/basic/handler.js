const { ServiceHandler } = require('../../index');
const handler = new ServiceHandler();
const initCount = { counter: 0 }
async function init(service_log) {
    initCount.counter++;
    service_log.debug(`basic handler init,${initCount.counter}`)
}
const hi = async (request, reply) => {
    const name = request.params != null && request.params.name != null ? request.params.name : null;
    reply.send(`hi${name != null ? ` ${name}` : ""}`)
}
function close(service_log) {
    service_log.info(`close home hanlder`)
}

handler.hi = hi;
handler.hiUser = hi;
handler.initHandler = init;
handler.closeHandler = close;
handler.initCounter = initCount;
module.exports = handler;