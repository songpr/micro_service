const { createVerifier } = require('fast-jwt')
const buildGetJwks = require('get-jwks')

// well known url of the token issuer
// often encoded as the `iss` property of the token payload
const domain = "https://api.line.me"

const getJwks = buildGetJwks({
    ttl: 5 * 60 * 1000,
    allowedDomains: [domain],
    jwksPath: "/oauth2/v2.1/certs",
})

test("get a public key of Line", async () => {
    const publicKey = await getJwks.getPublicKey({
        kid: "6aa8ad07cd2aaadcc656f7e2139cce8b8c4a6c81c29042f481680672fd03c969",
        alg: "ES256",
        domain: "https://api.line.me",
    })
    console.log(publicKey)
});

test("verify a line id token", async () => {

    const token = process.env["line_an_id_token"]
    // create a verifier function with key as a function
    const verifyWithPromise = createVerifier({
        key: async function (token) {
            const publicKey = await getJwks.getPublicKey({
                kid: token.kid,
                alg: token.alg,
                domain,
            })
            return publicKey
        },
        allowedIss: 'https://access.line.me',
        allowedAud: process.env["line_channel_id"],
        clockTolerance: 365 * 24 * 60 * 60 * 1000 //a year
    })
    const payload = await verifyWithPromise(token)
    console.log(payload)
});

