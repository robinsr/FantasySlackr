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
    crypto.randomBytes(2, function (ex, buf) {
        if (ex) throw ex;
        console.log('randomness=' + buf.toString('hex'))
        cb(buf.toString('hex'));
        return;
    })
}
function validateSession(n, s, cb) {
    console.log(n, s)

    // so that demos work regardless of sessions. its a problem if there are two people
    // trying to use the demo account at once
    if (n === 'demo') {
        console.log('demo session ' + s);
        cb(true);

        // regular session validation
    } else {
        client.exists("session:" + n, function (ex, r) {
            if (r === 0) {
                cb(false);
                return;
            } else {
                client.get("session:" + n, function (err, r) {
                    if (r == s) {
                        cb(true);
                        return;
                    } else {
                        cb(false);
                        return;
                    }
                })
            }
        });
    }
}
function invalidSession(req,res){
    var d = {
        header: "You're session expired",
        message1: "If you're seeing this a lot, we're probably doing something wrong",
        message2: "<p>Click <a href='/FantasyAutomate'>here</a> to login again</p>"
    }
    var html = ''
    mu.compileAndRender('genericMessagePage.html', d).on('data', function (data) {
        html += data.toString();
    }).on('end', function(){
        res.writeHead(200);
        res.end(html);
        return;
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

function constructDashboard(req,res){
	var query = qs.parse(nodeurl.parse(req.url).query);
	validateSession(query.user,query.sess,function(sessionValid){
		if (sessionValid){
            client.get('fantasyuser:'+query.user,function(err,result){

                if (err || (result == null)){
                    sendErrorResponse(res,"We're having some problems.","Please try again later.");
                } else {
                    var userData = JSON.parse(result);
                    if (userData.oauth_access_token && userData.oauth_access_token_secret){
                        t = userData.oauth_access_token;
                        ts = userData.oauth_access_token_secret;

                        callYahoo('http://fantasysports.yahooapis.com/fantasy/v2/league/314.l.148766','GET',t,ts,function(err,response){
                            if (err){
                                sendErrorResponse(res,"There was an error getting info from yahoo","Please try again later");
                            } else {
                                res.writeHead(200);
                                res.end(utils.inspect(response));
                            }
                        });
                    } else {
                        var d = {
                            header: "We still need something from you",
                            message1: "You have not allowed us access to your Yahoo Fantasy Sports account.",
                            message2: "<p>Click <a href='/FantasyAutomate/grantAccess?name="+query.user+"&sess="+query.sess+"'>here</a> to authorize with Yahoo</p>"
                        }
                        var html = ''
                        mu.compileAndRender('genericMessagePage.html', d).on('data', function (data) {
                            html += data.toString();
                        }).on('end', function(){
                            res.writeHead(200);
                            res.end(html);
                            return;
                        }); 
                    }      
                } 
            });	
		} else {
            invalidSession(req,res);
            return;
        }
	})
}
function callYahoo(url,method,token,token_secret,cb){
    generateNonce(function(nonce){
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
	client.expire("fantasy:oauth:"+token, 1800);
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
		                        client.set("fantasyuser:"+storedData.username,JSON.stringify(userdata),function(err){
		                        	if (err){
		                        		sendErrorResponse(res,"There was an error setting up your account","Please try again later");
		                        	} else {
		                        		var session_key = "session:"+storedData.username;
		                        		requestHash(function(session_val){
		                        			client.set(session_key, session_val, function () {
				                            client.expire(session_key, 1800);
				                            res.writeHead(302, { 'Location': 'dashboard?user='+storedData.username+'&sess='+session_val });
				                            res.end();
					                        client.del("fantasy:oauth:"+dataFromYahooCallback.oauth_token);
				                            return;
				                        	});
		                        		});
		                        	}
		                        });
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
                        var session_key = "session:" + data.uname;
                        client.set(session_key, session_val, function () {
                            client.expire(session_key, 1800);
                            res.writeHead(302, { 'Location': 'dashboard?user='+data.uname+'&sess='+session_val });
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
function logout(req, res) {
	var query = qs.parse(nodeurl.parse(req.url).query);
    var uname = "session:" + query.n;
    client.get(uname, function (err, c) {
        if (err) throw err;
        if (c) {
            client.del(uname, function () {
                res.writeHead(302, {
                	'Location' : '/FantasyAutomate/loggedout'
                });
                res.end();
            });
        } else {
            sendErrorResponse(res,'You were logged in? Maybe your session expired','')
			return;
        }
    });
}
function logoutSuccess(req,res){
	var d = {
		header: "Goodbye",
		message1: "You have been logged out",
		message2: ""
	}
	var html = ''
	mu.compileAndRender('genericMessagePage.html', d).on('data', function (data) {
	    html += data.toString();
  	}).on('end', function(){
  		res.writeHead(200);
	    res.end(html);
  	});
    return;
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
	} else if (p == '/dashboard'){
		constructDashboard(req,res);
		return
	} else if (p == '/logout'){
		logout(req,res);
		return;
	} else if (p == '/loggedout'){
		logoutSuccess(req,res);
		return;
    } else if (p =='/testRequest'){
        
    } else {
        serveStatic(req,res);
        return
    }
}
 
 
getKeys();
http.createServer(handler).listen(8133)
