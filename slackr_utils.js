var crypto = require('crypto'),
utils =         require('util');

module.exports.requestHash = function(cb) {
    crypto.randomBytes(16, function (ex, buf) {
        if (ex) throw ex;
        cb(buf.toString('hex'));
        return;
    })
}
var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';

exports.requestHashAsync = function(length) {
  length = length ? length : 32;
  
  var string = '';
  
  for (var i = 0; i < length; i++) {
    var randomNumber = Math.floor(Math.random() * chars.length);
    string += chars.substring(randomNumber, randomNumber + 1);
  }
  
  return string;
}

module.exports.ajaxBodyParser = function(req,cb){
    if (req.method == 'GET') cb({});
    var bodyText = '';
    req.on('data',function(chunk){
        bodyText += chunk;
    })
    req.on('end',function(){
      var parsed;
      try {
        parsed = JSON.parse(bodyText);
      } catch(ex) {
        parsed = {}
      } finally {
        cb(parsed);
      }
    });
}