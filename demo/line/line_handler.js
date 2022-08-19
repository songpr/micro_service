const { ServiceHandler } = require('../../index');
const handler = new ServiceHandler();

async function init(service_log) {
    service_log.info({ line_handler_config: this.config })
}
const getProfile = async (request, reply) => {
    return reply.send({ statusCode: 200, data: request.user });
}
function close(service_log) {
    service_log.info(`close line hanlder`)
}

handler.getProfile = getProfile;
handler.initHandler = init;
handler.closeHandler = close;
module.exports = handler;