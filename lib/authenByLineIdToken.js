'use strict'

const got = require('got');
const fp = require('fastify-plugin');

const defaultOptions = {
    bearerType: 'Bearer',
    isHook: true
}
const lineLoginVerify = got.extend({ prefixUrl: "https://api.line.me/oauth2/v2.1/verify", headers: { "Content-Type": "application/x-www-form-urlencoded" } })
function verifyByLineIdTokenFactory(fastify, options) {
    const _options = { ...defaultOptions, ...options };
    const { bearerType, lineOaClientId, isHook } = _options;
    if (lineOaClientId == null) throw Error("options: lineOaClientId is required");


    return (request, reply, done) => {
        const authorizationHeader = request.headers.authorization
        if (authorizationHeader == null) {
            const noHeaderError = Error('missing authorization header')
            request.log.error('unauthorized: %s', noHeaderError.message);
            done(noHeaderError)
            return
        }

        const idToken = header.substring(bearerType.length).trim()

        const invalidKeyError = Error('invalid authorization header');
        
    }
}

function plugin(fastify, options, done) {
    options = Object.assign({ isHook: true }, options)

    if (options.addHook === true) {
        fastify.addHook('onRequest', verifyByLineIdTokenFactory(fastify, options))
    } else {
        fastify.decorate('verifyByLineIdToken', verifyByLineIdTokenFactory(fastify, options))
    }
    done()
}

module.exports = fp(plugin, {
    fastify: '3.x',
    name: 'fastify-lineidtoken-auth'
})