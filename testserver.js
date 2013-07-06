var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    path = require('path'),
    querystring = require('querystring'),
    crypto = require('crypto')
    nodeurl = require('url')
    qs = require('qs'),
    redis = require('redis'),
    client = redis.createClient(),
    mu = require('mu2'),
    utils = require('util');

mu.root = __dirname + '/'
 
function generateNonce(cb){
    crypto.randomBytes(48, function(ex, buf) {
        cb(buf.toString('hex'));
        return
    });
}
function requestHash(cb) {
    crypto.randomBytes(16, function (ex, buf) {
        if (ex) throw ex;
        console.log('randomness=' + buf.toString('hex'))
        cb(buf.toString('hex'));
        return;
    })
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

	// separte server hosts oauth consumerKey and consumerSecret. only accessable locally
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

	// step 1 of oauth; gets request token
function getToken(cb){
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
                console.log('got request token');
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
 
        postReq.write(postData);
        postReq.end();
 
    })
}
function setTemporaryToken(token,secret,username){
	var set = {
		oauth_token_secret: secret,
		username: username
	}
	client.set("fantasy:oauth:"+token,JSON.stringify(set),function(err,r){});
}

	// part 2 of oauth; exchanges verifier for access token
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
 
                var postReq = https.request(postOptions, function(oauth_res){
                    oauth_res.setEncoding('utf8');
                    oauth_res.on('data',function(chunk){
                        console.log('data');
                        response += chunk;
                    });
                    oauth_res.on('end',function(){
                        console.log('end');
                        //cb();

                        var oauthResponse = querystring.parse(response)

                            // do stuff with data
                        client.get("fantasyuser:"+storedData.username,function(db_err,dat){
                        	if (db_err == null){
	                        	var userdata = JSON.parse(dat);
	                        	console.log('oauthResponse');
	                        	console.log(oauthResponse);
	                        	userdata.oauth_access_token = oauthResponse.oauth_token;
		                        userdata.oauth_access_token_secret = oauthResponse.oauth_token_secret;
		                        userdata.oauth_session_handle = oauthResponse.oauth_session_handle;
		                        userdata.xoauth_yahoo_guid = oauthResponse.xoauth_yahoo_guid;
		                        res.writeHead(200);
		                        res.end(utils.inspect(userdata));
		                        client.del("fantasy:oauth:"+dataFromYahooCallback.oauth_token);
		                    } else {
		                    	sendErrorResponse(res,"There was an error setting up your account","Please try again later");
							}
                        })
                    });
                    oauth_res.on('error',function(err){
                    	sendErrorResponse(res,"There was an error setting up your account","Please try again later");
                        console.log('***** there was an error *****');
                        console.log(err);
                    });
                });
                postReq.write(postData);
                postReq.end();
            }
        });    
    });
}

	// sets session keys for users and (in future) get new oauth token
function login(req, res, data) {
    var p = /[0-9a-f]{32}/
    var uname = "fantasyuser:" + data.uname;
    client.get(uname, function (err, r) {
        if (err) {
            console.log('error');
        } else {
            if (r !== null) {
                var user_object = JSON.parse(r);
                var return_object = {};
                var concat_pass = data.pass + user_object.salt;
                var hashed_pass = crypto.createHash('md5').update(concat_pass).digest('hex');
                if (hashed_pass == user_object.pass) {
                    requestHash(function (session_val) {
                        return_object.sessionid = session_val;
                        if (user_object.email) {
                            return_object.email = user_object.email
                        } else {
                            return_object.email = 'no email';
                        }
                        var session_key = "session:" + query.name;
                        client.set(session_key, session_val, function () {
                            client.expire(session_key, 1800);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(return_object));
                            return;
                        });
                    });
                } else {
                    res.writeHead(400, { 'Content-Type': 'text/plain' });
                    res.end('Invalid Username or Password');
                    return;
                }
            } else {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('User not found');
                return;
            }
        }
    })
}

	// creates user in database and begins oauth process, sends link to yahoo auth page if successful
function createUser(req, res, data) {
	var uname = "fantasyuser:" + data.signup_uname;
    client.exists(uname, function (ex, r) {
        console.log(r);
        if (r == 1) {
        	sendErrorResponse(res,"Account already exists for "+data.signup_uname,"Please try a different username")
			return;
        } else {
            requestHash(function (hash_salt) {
                var hashed_pass_and_salt = crypto.createHash('md5').update(data.signup_pass + hash_salt).digest('hex');
                getToken(function(oauth_err,oauth){
                	if (oauth_err == null){
	                	setTemporaryToken(oauth.oauth_token,oauth.oauth_token_secret,data.signup_uname);
		                var user_setup = {
		                    name: data.signup_uname,
		                    email: data.signup_email,
		                    pass: hashed_pass_and_salt,
		                    salt: hash_salt,
		                    oauth_token: oauth.oauth_token,
		                    oauth_token_secret: oauth.oauth_token_secret,
		                    xoauth_request_auth_url: oauth.xoauth_request_auth_url
		                };
		                console.log(user_setup);
		                var udata = JSON.stringify(user_setup);
		                
		                client.set(uname, udata, function (err, rr) {
		                    if (err) {
		                    	sendErrorResponse(res,"There was an error setting up your account","Please try again later");
		            			return;
		                    } else {
	                    		var d = {
					    			uname: user_setup.name,
					    			url: user_setup.xoauth_request_auth_url
						    	}
						    	var html = ''
						    	mu.compileAndRender('successpage.html', d).on('data', function (data) {
								    html += data.toString();
							  	}).on('end', function(){
							  		res.writeHead(200);
								    res.end(html);
							  	});
			                    return;
		                    }
		                });
		            } else {
		            	sendErrorResponse(res,"There was an error setting up your account","Please try again later");
		            	return;
		            }
                });
            });
        }
    });
}

	// generic error page with 2 custom messages
function sendErrorResponse(res,message1,message2){
	var html = '';
    mu.compileAndRender('errorpage.html',{ message1: message1, message2: message2 }).on('data', function (data) {
	    html += data.toString();
  	}).on('end', function(){
  		res.writeHead(500);
	    res.end(html);
  	});
}


	// These function serve as a launching points into more server functions, 
	// a sort of intermediary between server code and the incoming http request
	// They are genrally called from "handler"
function loginFormHandler(req,res){
	console.log('login form accepted');
	var fullbody = '';

	req.on('data', function(chunk){
		fullbody += chunk
	});
	req.on('end',function(){
		login(req,res,querystring.parse(fullbody));
	})
} 
function signupFormHandler(req,res){
	console.log('signup form accepted');
	var fullbody = '';

	req.on('data', function(chunk){
		fullbody += chunk
	});
	req.on('end',function(){
		createUser(req,res,querystring.parse(fullbody));
		return;
	})
}
 
	// handles static content - usually passed off to nginx after dev is complete
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
 
 	// handles incoming http requests
function handler(req,res){
    req.url = req.url.replace('/FantasyAutomate', '');
    var p = nodeurl.parse(req.url).pathname;
    console.log(req.url,p);
 
	if (p == '/apicallback'){
        getAccess(req,res);
        return;
	} else if (p == '/loginForm'){
		loginFormHandler(req,res);
		return;
	} else if (p == '/signupForm'){
		signupFormHandler(req,res);
		return;
    } else {
        serveStatic(req,res);
        return
    }
}
 
 
getKeys();
http.createServer(handler).listen(8133)
