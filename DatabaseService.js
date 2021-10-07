
class DatabaseService {
    async start() {
    }
    async close() {
    }

}

const mysql = require("mysql2");

class MySQLDatabaseService extends DatabaseService {
    constructor(mysql_config) {
        super();
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
    }

    get pool() {
        return this._pool;
    }

    get promisePool() {
        return this._promisePool;
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