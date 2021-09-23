const { ServiceHandler } = require('../../index');
const handler = new ServiceHandler();

async function init(service_log) {
    service_log.info({ line_handler_config: this.config })
}
const getToken = async (request, reply) => {
    reply.send({ statusCode: 200, data: { token: "ZZVdbXF4gUbY8mQjNGqoy7p2KY2FZffGFDAKpcZcdFbztedbntkv7rjbKQrooJrG" } });
    return;
}
function close(service_log) {
    service_log.info(`close line hanlder`)
}

handler.getToken = getToken;
handler.initHandler = init;
handler.closeHandler = close;
module.exports = handler;