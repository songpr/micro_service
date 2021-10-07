const { MySQLDatabaseService } = require("../DatabaseService");
const util = require("../lib/util")
const mysql_config =
    `{    
    "pool": {
        "connectionLimit": "%{db_connectionLimit}",
        "queueLimit": 40000,
        "host": "\${db_host}",
        "user": "\${db_user}",
        "password": "\${db_password}",
        "database": "\${db_database}",
        "charset": "utf8mb4_unicode_ci",
        "enableKeepAlive": true,
        "ssl": {
            "ca": "/BaltimoreCyberTrustRoot.crt.pem"
        }
    },
    "monitor": {
        "note": "the test sql will run to monitor mysql, if fail the exception will be throw. so it must be fast and quick check",
        "test_sql": "SELECT 1 from users limit 1"
    }
}`
const fs = require("fs");
test("test mysql service", async () => {
    const mysql_config_object = JSON.parse(util.replaceByEnv(mysql_config));
    if (mysql_config_object.pool.ssl.ca != null) {
        mysql_config_object.pool.ssl.ca = fs.readFileSync(__dirname + mysql_config_object.pool.ssl.ca, { encoding: "utf8", flag: "r" });
    }
    console.log(mysql_config_object.pool);
    const mysql = new MySQLDatabaseService(mysql_config_object);
    await mysql.start();
    await mysql.close();
})