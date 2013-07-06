var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    path = require('path'),
    querystring = require('querystring'),
    crypto = require('crypto')
    nodeurl = require('url')
    qs = require('qs'),
    redis = require('redis'),
    client = redis.createClient()
 
function generateNonce(cb){
    crypto.randomBytes(48, function(ex, buf) {
        cb(buf.toString('hex'));
        return
    });
}
 
var mimeType = {
    '.js': 'text/javascript',
    '.html': 'text/html',
    '.css': 'text/css',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.ttf': 'application/x-font-ttf',
    '.otf': 'application/x-font-opentype',
    '.woff': 'application/x-font-woff',
    '.eot': 'application/vnd.ms-fontobject',
    '': 'text/html'
};
 
var consumerKey,consumerSecret;
 
function getKeys(){
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
}
 
 
 
 
function getToken(req,res){
    generateNonce(function(nonce){
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
                console.log('end');
                var responseObject = querystring.parse(response);
 
                client.set("fantasy:oauth:"+responseObject.oauth_token, JSON.stringify(responseObject),function(err,ex){
                    if (err){
                        res.writeHead(503);
                        res.end("server error, prolly the db");
                        return;
                    } else {
                        res.writeHead(302, {
                            'Location': data.xoauth_request_auth_url
                        });
                        res.end();
                        return;
                    }
                })
            });
            res.on('error',function(err){
                console.log('***** there was an error *****');
                console.log(err);
            })
        });
 
        postReq.write(postData);
        postReq.end();
 
    })
}
function getAccess(req,res){
    var dataFromYahooCallback = qs.parse(nodeurl.parse(req.url).query);
    generateNonce(function(nonce){
        client.get("fantasy:oauth:"+dataFromYahooCallback.oauth_token,function(err,result){
            if (err){
                console.log('database error; get access')
            } else {
                console.log(result);
                var storedData = JSON.parse(result);
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
 
                var postReq = https.request(postOptions, function(res){
                    res.setEncoding('utf8');
                    res.on('data',function(chunk){
                        console.log('data');
                        response += chunk;
                    });
                    res.on('end',function(){
                        console.log('end');
                        //cb();

                        var oauthResponse = querystring.parse(response)

                            // do stuff with data
                        storedData.oauth_token = oauthResponse.oauth_token;
                        storedData.oauth_token_secret = oauthResponse.oauth_token_secret;
                        storedData.oauth_session_handler = oauthResponse.oauth_session_handler;
                        storedData.xoauth_yahoo_guid = oauthResponse.xoauth_yahoo_guid;

                            // or 

                        // for (var l in oauthResponse){
                        //     storedData[l] = oauthResponse[l];
                        // }

                            // redirect user to their page
                    });
                    res.on('error',function(err){
                        console.log('***** there was an error *****');
                        console.log(err);
                    })
                });
 
                postReq.write(postData);
                postReq.end();
            }
        })
             
 
    })
}
 
 
// handles static content
function serveStatic(req, res) {
    var filePath = '.' + req.url;
    if (filePath == './') {
        filePath = './login.html';
    }
    fs.exists(filePath, function (exists) {
        if (exists) {
 
            fs.readFile(filePath, function (error, content) {
                if (error) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end();
                }
                else {
                    res.writeHead(200, { 'Content-Type': mimeType[path.extname(filePath)] });
                    res.end(content, 'utf-8');
                }
            });
        }
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 - Not Found - '+filePath);
        }
    });
}
 
function handler(req,res){
    req.url = req.url.replace('/FantasyAutomate', '');
    var p = nodeurl.parse(req.url).pathname;
    console.log(req.url,p);
 
    if (p == '/getYahooAccess'){
        getToken(req,res);
        return;
    } else if ( p == '/apicallback'){
        getAccess(req,res);
        return;
    } else {
        serveStatic(req,res);
        return
    }
}
 
 
getKeys();
http.createServer(handler).listen(8133)
