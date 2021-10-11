const util = require("../util");

test("replace env with default", async () => {
    const config_string = `
{
    "config": {
        "private_key_base64": "\${private_key_base64}",
        "public_key_base64": "\${public_key_base64}"
    }
}`

    console.log(util.replaceByEnv(config_string));
    const replaced_config = JSON.parse(util.replaceByEnv(config_string));
    const fastify = require('fastify')();
    const jwt = require('fastify-jwt')
    fastify.register(jwt, {
        secret: {
            private: Buffer.from(replaced_config.config.private_key_base64, 'base64').toString('utf8'),
            public: Buffer.from(replaced_config.config.public_key_base64, 'base64').toString('utf8')
        },
        sign: { algorithm: 'RS256' }
    })
    await fastify.ready();
});