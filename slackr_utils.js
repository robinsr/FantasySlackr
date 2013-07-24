var crypto = require('crypto');

var generateNonce = function(cb){
    crypto.randomBytes(16, function(ex, buf) {
        cb(buf.toString('hex'));
        return
    });
}
var requestHash = function(cb) {
    crypto.randomBytes(16, function (ex, buf) {
        if (ex) throw ex;
        console.log('randomness=' + buf.toString('hex'))
        cb(buf.toString('hex'));
        return;
    })
}

module.exports.generateNonce = generateNonce;
module.exports.requestHash = requestHash;