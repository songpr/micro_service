const util = require("../util");

test("replace env with default", async () => {
    const config_string = `
{
    "config": {
        "private_key_base64": "\${private_key}",
        "public_key_base64": "\${public_key}"
    }
}`


    process.env.private_key_base64 = "LS0tLS1CRUdJTiBFQyBQQVJBTUVURVJTLS0tLS0KQmdVcmdRUUFDZz09Ci0tLS0tRU5EIEVDIFBBUkFNRVRFUlMtLS0tLQotLS0tLUJFR0lOIEVDIFBSSVZBVEUgS0VZLS0tLS0KTUhRQ0FRRUVJRXhOMm9HVUFsR0ZMV0k2SitLamlFTWI3REswaFZpazJCendEOVpwSEhKb29BY0dCU3VCQkFBSwpvVVFEUWdBRW9BTWxVK2pjNnVSbDliWVJoWnZuY3ZINld6Wi9XMENTU2FFbU5PbVNsMDlja2ZZY1FkNzl0TlZSCkJlT1BEbm4rQjBYWEllRysveEE5NEQxNDVOeE9qZz09Ci0tLS0tRU5EIEVDIFBSSVZBVEUgS0VZLS0tLS0K";
    process.env.public_key_base64 = "LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUZZd0VBWUhLb1pJemowQ0FRWUZLNEVFQUFvRFFnQUVvQU1sVStqYzZ1Umw5YllSaFp2bmN2SDZXelovVzBDUwpTYUVtTk9tU2wwOWNrZlljUWQ3OXROVlJCZU9QRG5uK0IwWFhJZUcrL3hBOTREMTQ1TnhPamc9PQotLS0tLUVORCBQVUJMSUMgS0VZLS0tLS0K";
    console.log(util.replaceByEnv(config_string));
    const replaced_config = JSON.parse(util.replaceByEnv(config_string));
    const fastify = require('fastify')();
    const jwt = require('fastify-jwt')
    fastify.register(jwt, {
        secret: {
            private: Buffer.from(replaced_config.config.private_key, 'base64').toString('utf8'),
            public: Buffer.from(replaced_config.config.public_key, 'base64').toString('utf8')
        },
        sign: { algorithm: 'RS256' }
    })
    await fastify.ready();
});