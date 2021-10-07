
class DatabaseService {
    constructor(config) {
        const _config = Object.freeze(config);
        Object.defineProperty(this, 'config', { get: () => _config, enumerable: true });
    }
    async start() {
        //make sure init of the same instance will be called only once
        if (this.isStarted === true) {
            return;
        }
        else {
            const started = true;
            Object.defineProperty(this, 'isStarted', { get: () => started, enumerable: true });
        }
    }
    async close() {
        //make sure init of the same instance will be called only once
        if (this.isClosed === true) {
            return;
        }
        else {
            const closed = true;
            Object.defineProperty(this, 'isClosed', { get: () => closed, enumerable: true });
        }

    }

}

const mysql = require("mysql2");

function jsonDateReplacer(key, value) {
    if (this[key] instanceof Date) {
        const orgValue = this[key];
        if (Number.isNaN(orgValue.getTime())) return null;
        const escape_date_str = mysql.escape(orgValue);
        return escape_date_str.substring(1, escape_date_str.length - 1);
    }
    return value;
}
class MySQLDatabaseService extends DatabaseService {
    constructor(mysql_config) {
        super(mysql_config);
        const pool = mysql.createPool(mysql_config.pool);
        Object.defineProperty(this, '_pool', {
            value: pool,
            enumerable: false,
            configurable: false
        })
        // now get a Promise wrapped instance of that pool
        const promisePool = pool.promise();
        Object.defineProperty(this, '_promisePool', {
            value: promisePool,
            enumerable: false,
            configurable: false
        })
    }
    async start() {
        if (this.isStarted === true) {
            return;
        } else {
            await super.start();
        }
        await this.promisePool.execute(this.config.monitor.test_sql);
    }

    async close() {
        if (this.isClosed === true) {
            return;
        } else {
            await super.close();
        }
        await this.pool.end()
    }

    get pool() {
        return this._pool;
    }

    get promisePool() {
        return this._promisePool;
    }

    escapeJson(json) {
        return JSON.stringify(json, jsonDateReplacer)
    }
    escape(value) {
        return mysql.escape(value);
    }

    escapeId(identifier) {
        return mysql.escapeId(identifier);
    }
    format(sql) {
        return mysql.format(sql);
    }

}
module.exports = {
    DatabaseService: DatabaseService,
    MySQLDatabaseService: MySQLDatabaseService
}