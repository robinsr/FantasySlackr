var http = require('http'),
    https = require('https'),
    slackr_utils = require('./slackr_utils'),
    fs = require('fs'),
    querystring = require('querystring'),
    crypto = require('crypto'),
    appMonitor = require('./appMonitor');

	// separte server hosts oauth consumerKey and consumerSecret. only accessable locally
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
        });
    });
    keyReq.write(postData);
    keyReq.end();
})();

function logCall(d){
    fs.appendFile('apirequests.log',JSON.stringify(d)+"\n");
}
    // the following function create an ouath signiture 
function generateOAuthSignature(method,base_url,oauth,token_secret,cb){
    var keys = [];
    for (var d in oauth){
        keys.push(d);
    }
    keys.sort();
    var output =  encodeURIComponent(method) + "&" + encodeURIComponent(base_url) + "&";
    var params = "";
    keys.forEach(function(k){
        params += "&" + encodeURIComponent(k) + "=" + encodeURIComponent(oauth[k]);
    });
    params = encodeURIComponent(params.substring(1));

    var oauthHeader = "";
    for (var k in oauth){
        oauthHeader += ", " + encodeURIComponent(k) + "=\"" + encodeURIComponent(oauth[k]) + "\"";
    }
    oauthHeader = oauthHeader.substring(1);

    var signingKey = encodeURIComponent(consumerSecret);
    signingKey += "&";
    signingKey += encodeURIComponent(token_secret);

    cb(crypto.createHmac('sha1',signingKey).update(output+params).digest('base64'));
}

var callYahoo = function (url,method,token,token_secret,cb){
    slackr_utils.generateNonce(function(nonce){
        var oauth = {
            oauth_consumer_key: consumerKey,
            oauth_nonce: nonce,
            oauth_signature_method:'HMAC-SHA1',
            oauth_timestamp:  Math.round((new Date()).getTime() / 1000),
            oauth_token: token,
            oauth_version: "1.0"
        }
        generateOAuthSignature(method,url,oauth,token_secret,function(sig){
            console.log('sig: '+sig);
            oauth.oauth_signature = sig;
            var oauthHeader = "";
            for (var k in oauth){
                console.log('encoding');
                oauthHeader += ", " + encodeURIComponent(k) + "=\"" + encodeURIComponent(oauth[k]) + "\"";
            }
            oauthHeader = oauthHeader.substring(1);
            logCall({req:JSON.stringify(oauth)});
     
            var postOptions = {
                host: nodeurl.parse(url).hostname,
                port: 80,
                path: nodeurl.parse(url).pathname,
                method: method,
                headers: {
                    'Content-Type' :'application/x-www-form-urlencoded',
                    'Authorization': "Oauth" + oauthHeader
                }
            };
            var response = ''
            var postReq = http.request(postOptions, function(res){
                res.setEncoding('utf8');
                res.on('data',function(chunk){
                    console.log('data');
                    response += chunk;
                });
                res.on('end',function(){
                    console.log('yahoo responded!');
                    logCall({res:response.toString()});
                    cb(null,querystring.parse(response));
                    return;
                })
                res.on('error',function(err){
                    console.log('***** there was an error *****');
                    console.log(err);
                    cb(1,null)
                    return;
                })
            });
     
            postReq.write('');
            postReq.end();
        });
    });
}
module.exports.callYahoo = callYahoo;

    // step 1 of oauth; gets request token
var getToken = function (cb){
    slackr_utils.generateNonce(function(nonce){
        var response = ''
 
        var postData = querystring.stringify({
            'oauth_nonce' : nonce,
            'oauth_timestamp' : new Date().getTime(),
            'oauth_consumer_key' : consumerKey,
            'oauth_signature_method' : 'plaintext',
            'oauth_signature' : consumerSecret+'&',
            'oauth_version' : '1.0',
            'xoauth_lang_pref' : "en-us", 
            'oauth_callback' : 'http://demos.ethernetbucket.com/FantasyAutomate/apicallback'
        });
 
        var postOptions = {
            host: 'api.login.yahoo.com',
            port: 443,
            path: '/oauth/v2/get_request_token',
            method: 'POST',
            headers: {
                'Content-Type' :'application/x-www-form-urlencoded',
                'Content-length' : postData.length
            }
        };
 
        var postReq = https.request(postOptions, function(res){
            res.setEncoding('utf8');
            res.on('data',function(chunk){
                console.log('data');
                response += chunk;
            });
            res.on('end',function(){
                console.log('got request token');
                var resObj = querystring.parse(response);
                appMonitor.sendMessage('oauth','get token response: '+JSON.stringify(resObj));
                
                	// check response for valid response
                if(typeof resObj.oauth_token == 'undefined'){
                    cb(1,null)
                } else {
                    cb(null,resObj.oauth_token,resObj.oauth_token_secret,resObj.xoauth_request_auth_url);   
                }
            })
            res.on('error',function(err){
                console.log('***** there was an error getting request token *****');
                console.log(err);
                cb(1,null)
                return;
            })
        });
 
        postReq.write(postData);
        postReq.end();
 
    })
}
module.exports.getToken = getToken;

  // refresh token
var refreshToken = function (user_token,user_token_secret,user_session_handle,cb){
  slackr_utils.generateNonce(function(nonce){
    var response = ''
 
    var postData = querystring.stringify({
      'oauth_nonce' : nonce,
      'oauth_timestamp' : new Date().getTime(),
      'oauth_consumer_key' : consumerKey,
      'oauth_signature_method' : 'plaintext',
      'oauth_signature' : consumerSecret+'&'+user_token_secret,
      'oauth_version' : '1.0',
      'xoauth_lang_pref' : "en-us", 
      'oauth_token' : user_token,
      'oauth_session_handle' : user_session_handle
    });
 
    var postOptions = {
      host: 'api.login.yahoo.com',
      port: 443,
      path: '/oauth/v2/get_request_token',
      method: 'POST',
      headers: {
        'Content-Type' :'application/x-www-form-urlencoded',
        'Content-length' : postData.length
      }
    };
 
    var postReq = https.request(postOptions, function(res){
      res.setEncoding('utf8');
      res.on('data',function(chunk){
        console.log('data');
        response += chunk;
      });
      res.on('end',function(){
        console.log('got request token');
        var resObj = querystring.parse(response)

        // check response for valid response

        if(typeof resObj.oauth_token == 'undefined'){
            cb(1,null)
        } else {
            cb(null,resObj.oauth_token,resObj.oauth_token_secret,resObj.xoauth_request_auth_url);	
        }
      });
      res.on('error',function(err){
        console.log('***** there was an error refreshing token *****');
        console.log(err);
        cb(1,null)
        return;
      })
    });

    postReq.write(postData);
    postReq.end();
  });
}
module.exports.refreshToken = refreshToken;

    // part 2 of oauth; exchanges verifier for access token
var getAccess = function(dataFromYahooCallback,storedData,cb){
    slackr_utils.generateNonce(function(nonce){
        var response = ''
        var postData = querystring.stringify({
            'oauth_nonce' : nonce,
            'oauth_timestamp' : new Date().getTime(),
            'oauth_consumer_key' : consumerKey,
            'oauth_signature_method' : 'plaintext',
            'oauth_signature' : consumerSecret+'&'+storedData.oauth_token_secret,
            'oauth_verifier': dataFromYahooCallback.oauth_verifier,
            'oauth_token' : dataFromYahooCallback.oauth_token
        });
        console.log(postData);

        var postOptions = {
            host: 'api.login.yahoo.com',
            port: 443,
            path: '/oauth/v2/get_token',
            method: 'POST',
            headers: {
                'Content-Type' :'application/x-www-form-urlencoded',
                'Content-length' : postData.length
            }
        };

        logCall({req:postData});

        var postReq = https.request(postOptions, function(oauth_res){
            oauth_res.setEncoding('utf8');
            oauth_res.on('data',function(chunk){
                console.log('data');
                response += chunk;
            });
            oauth_res.on('end',function(){
                console.log('end');
                cb(null,querystring.parse(response))
            });
            oauth_res.on('error',function(err){
                console.log('***** there was an error getting access token *****');
                console.log(err);
                cb(1,null)
                return;
            });
        });

        postReq.write(postData);
        postReq.end();
    });
}
module.exports.getAccess = getAccess;
