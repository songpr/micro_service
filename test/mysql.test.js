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
test("test mysql service", async () => {
    const mysql = new MySQLDatabaseService(JSON.parse(util.replaceByEnv(mysql_config)));
    await mysql.start();
    await mysql.close();
})