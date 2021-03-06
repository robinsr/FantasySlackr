var crypto = require('crypto'), utils = require('util');
module.exports.requestHash = function (cb) {
  crypto.randomBytes(16, function (ex, buf) {
    if (ex)
      throw ex;
    cb(buf.toString('hex'));
    return;
  });
};
var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
module.exports.requestHashAsync = function (length) {
  length = length ? length : 32;
  var string = '';
  for (var i = 0; i < length; i++) {
    var randomNumber = Math.floor(Math.random() * chars.length);
    string += chars.substring(randomNumber, randomNumber + 1);
  }
  return string;
};
module.exports.ajaxBodyParser = function (req, cb) {
  if (req.method == 'GET')
    cb({});
  var bodyText = '';
  req.on('data', function (chunk) {
    bodyText += chunk;
  });
  req.on('end', function () {
    var parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (ex) {
      parsed = {};
    } finally {
      console.log(utils.inspect(parsed));
      cb(parsed);
    }
  });
};
module.exports.checkdata = function (req, res, expectedData, actualdata, cb) {
  var checked = [];
  expectedData.forEach(function (piece) {
    if (typeof actualdata[piece] == 'undefined') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ RequestParameterMissing: piece }));
      return;
    } else {
      checked.push(piece);
      if (checked.length == expectedData.length) {
        cb();
      }
    }
  });
};
module.exports.isError = function (test, next) {
  if (utils.isError(test)) {
    next(test, null);
  } else {
    next(null, test);
  }
};
/**
 * deepProperty - finds if a deeply nested key exists
 * @param  {[type]}   testString ex: "i.am.a.deeply.nested.key"
 * @param  {Object} callback   object with fail and success functions
 */
Object.prototype.deepProperty = function (testString, callback) {
  var exists = true;
  try {
    eval(testString);
  } catch (e) {
    exists = false;
  } finally {
    if (exists)
      callback.success.call(this, arguments);
    else
      callback.fail.call(this, arguments);
  }
};

var clone = function(obj){
// return primitives
  if(obj == null || typeof(obj) != 'object') return obj;
  // create a blank obkect {} or array []
  var temp = obj.constructor();
  // copy keys over recursive
  for(var key in obj)
    console.log(key);
    temp[key] = clone(obj[key]);
  return temp;
}
module.exports.clone = clone;