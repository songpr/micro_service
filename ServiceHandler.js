const util = require("util");
const DatabaseService = require("./DatabaseService");
class NodeServiceHandler {
    async init(service_handler_config, serviceLog, databaseService = null) {
        //make sure init of the same instance will be called only once
        if (this.isInited === true) {
            return;
        }
        else {
            const init = true;
            Object.defineProperty(this, 'isInited', { get: () => init, enumerable: true });
            Object.defineProperty(this, 'config', { get: () => service_handler_config, enumerable: true });
        }
        if (this.initHandler != null) {
            const initResult = util.types.isAsyncFunction(this.initHandler) ? await this.initHandler(serviceLog) : this.initHandler(serviceLog);
        }
        if (databaseService != null && databaseService instanceof DatabaseService) {
            const _databaseService = Object.freeze(databaseService);
            Object.defineProperty(this, databaseService.type, { get: () => _databaseService, enumerable: true });
        }
    }
    async close(serviceLog) {
        //make sure close of the same instance will be called only once
        if (this.isClosed === true) {
            return;
        }
        else {
            const close = true;
            Object.defineProperty(this, 'isClosed', { get: () => close, enumerable: true });
        }
        if (this.closeHandler != null) {
            const closeResult = util.types.isAsyncFunction(this.closeHandler) ? await this.closeHandler(serviceLog) : this.closeHandler(serviceLog);
        }
    }
}
module.exports = NodeServiceHandler