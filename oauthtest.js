var http = require('http'),
    https = require('https'),
    slackr_utils = require('./slackr_utils'),
    fs = require('fs'),
    querystring = require('querystring'),
    crypto = require('crypto'),
    appMonitor = require('./appMonitor'),
    utils = require('util'),
    OAuth = require('mashape-oauth').OAuth;

	// separte server hosts oauth consumerKey and consumerSecret. only accessable locally
var consumerKey,consumerSecret,oa,oa2;
(function(){
    console.log('getting keys');
    var response = '';
    var postData = '';
    var postOptions = {
        host: '127.0.0.1',
        port: 8134,
        method: 'GET',
        headers: {
            'Content-Type' :'application/x-www-form-urlencoded'
        }
    };
    var keyReq = http.request(postOptions,function(res){
        res.on('data',function(chunk){
            console.log('data');
            response += chunk;
        });
        res.on('end',function(){
            console.log('end');
            var keys = JSON.parse(response);
 
            consumerKey = keys.consumerKey;
            consumerSecret = keys.consumerSecret;
            console.log(consumerKey);


              // oauth object for getting access
            oa  = new OAuth({
                realm: 'apis.yahoo.com',
                requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
                accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token',
                consumerKey: consumerKey,
                consumerSecret: consumerSecret,
                signatureMethod: 'PLAINTEXT',
                nonceLength: 16,
                callback: "http://demos.ethernetbucket.com/FantasyAutomate/apicallback"
            });

              // oauth for calling api (uses HMAC-SHA1)
            oa2 = new OAuth({
              realm: 'apis.yahoo.com',
                requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
                accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token',
                consumerKey: consumerKey,
                consumerSecret: consumerSecret,
                signatureMethod: 'HMAC-SHA1',
                nonceLength: 16,

            })
        });
    });
    keyReq.write(postData);
    keyReq.end();
})();



console.log(utils.inspect(oa));

module.exports.getToken = function(cb){
  oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret, results) {
    if (error){
      appMonitor.sendMessage('error','oa module errored at getToken (line 58) '+utils.inspect(error));
      cb(1);
      return 
    } else {
      cb(null,oauth_token,oauth_token_secret,results.xoauth_request_auth_url);
      // Usually a redirect happens here to the /oauth/authorize stage
    }
  });
}

module.exports.getAccess = function(oauth_token,oauth_verifier,oauth_secret,cb){
  oa.getOAuthAccessToken({
    oauth_verifier: oauth_verifier,
    oauth_token: oauth_token,
    oauth_token_secret: oauth_secret
  }, function (error, token, secret, result) {
    if (error){
      appMonitor.sendMessage('error','oa module errored at getToken (line 80) '+utils.inspect(error));
      cb(1);
      return
    } else {
      cb(null,token,secret,result);
    }
  });
}

module.exports.refreshToken = function(oauth_token,oauth_secret,handle,cb){
  oa.getOAuthAccessToken({
    oauth_token: oauth_token,
    oauth_token_secret: oauth_secret,
    parameters : {
      oauth_session_handle: handle
    }
  }, function (error, token, secret, result) {
    if (error){
      appMonitor.sendMessage('error','oa module errored at getToken (line 110) '+utils.inspect(error));
      cb(1);
      return
    } else {
      appMonitor.sendMessage('debug','oa refreshToken returned '+utils.inspect(result));
      cb(null,token,secret,result);
    }
  });
}

module.exports.getYahoo = function(url,token,secret,cb){
  oa2.get({
    url:url,
    oauth_token: token,
    oauth_token_secret: secret
  },function(error,result){
    if (error) {
      cb(1);
      return
    } else {
      cb(result);
    }
  });
}
