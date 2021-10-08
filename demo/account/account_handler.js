const { ServiceHandler } = require('../../index');
const handler = new ServiceHandler();

async function init(service_log) {
    service_log.info({ line_handler_config: this.config })
}
const getToken = async (request, reply) => {
    const token = await reply.jwtSign({ id: "aaa" });
    return reply.send({ statusCode: 200, data: { token, expired_at: new Date(Date.now() + 180000) } });
}
function close(service_log) {
    service_log.info(`close line hanlder`)
}

handler.getToken = getToken;
handler.initHandler = init;
handler.closeHandler = close;
module.exports = handler;