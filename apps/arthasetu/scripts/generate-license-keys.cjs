const { generateKeyPairSync } = require('node:crypto')

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
console.log('Keep this private JWK only in the server environment variable LICENSE_PRIVATE_JWK:')
console.log(JSON.stringify(privateKey.export({ format: 'jwk' })))
console.log('\nSet this public JWK as VITE_LICENSE_PUBLIC_KEY for app builds:')
console.log(JSON.stringify(publicKey.export({ format: 'jwk' })))
