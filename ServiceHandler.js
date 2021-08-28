const util = require("util");
class NodeServiceHandler {
    async init(config, service_log) {
        //make sure init of the same instance will be called only once
        if (this.isInit === true) {
            return;
        }
        else {
            const init = true;
            Object.defineProperty(this, 'isInit', { get: () => init, enumerable: true });
        }
        if (this.initHanlder != null) {
            const initResult = util.types.isAsyncFunction(this.initHanlder) ? await this.initHanlder(service_log) : this.initHanlder(service_log);
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
        if (this.closeHanlder != null) {
            const closeResult = util.types.isAsyncFunction(this.closeHanlder) ? await this.closeHanlder(service_log) : this.closeHanlder(service_log);
        }
    }
}
module.exports = NodeServiceHandler