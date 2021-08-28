const util = require("util");
class NodeServiceHandler {
    async init(service_handler_config, service_log) {
        //make sure init of the same instance will be called only once
        if (this.isInit === true) {
            return;
        }
        else {
            const init = true;
            Object.defineProperty(this, 'isInit', { get: () => init, enumerable: true });
            Object.defineProperty(this, 'config', { get: () => service_handler_config, enumerable: true });
        }
        if (this.initHandler != null) {
            const initResult = util.types.isAsyncFunction(this.initHandler) ? await this.initHandler(service_log) : this.initHandler(service_log);
        }
    }
    async close(service_log) {
        //make sure close of the same instance will be called only once
        if (this.isClose === true) {
            return;
        }
        else {
            const close = true;
            Object.defineProperty(this, 'isClose', { get: () => close, enumerable: true });
        }
        if (this.closeHandler != null) {
            const closeResult = util.types.isAsyncFunction(this.closeHandler) ? await this.closeHandler(service_log) : this.closeHandler(service_log);
        }
    }
}
module.exports = NodeServiceHandler