var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    querystring = require('querystring'),
    crypto = require('crypto')
    nodeurl = require('url')
    qs = require('qs'),
    redis = require('redis'),
    client = redis.createClient(),
    mu = require('mu2'),
    utils = require('util'),
    serveStatic = require('./serveStatic'),
    slackr_utils = require('./slackr_utils'),
    templates = require('./templates'),
    oauth = require('./oauth');

mu.root = __dirname + '/'
 

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
var consumerKey,consumerSecret;


function appMonitor(level,message){
    var postData = {
    	level: level,
    	message: message
    }
    var postOptions = {
        host: '127.0.0.1',
        port: 8135,
        method: 'POST',
        headers: {
            'Content-Type' :'application/json'
        }
    };
    var keyReq = http.request(postOptions,function(res){
        res.on('end',function(){
            console.log("sent to App Monitor: ",level,message);
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
                    templates.sendErrorResponse(res,"We're having some problems.","Please try again later.");
                } else {
                    var userData = JSON.parse(result);
                    if (userData.oauth_access_token && userData.oauth_access_token_secret){
                        t = userData.oauth_access_token;
                        ts = userData.oauth_access_token_secret;

                        oauth.callYahoo('http://fantasysports.yahooapis.com/fantasy/v2/league/314.l.148766','GET',t,ts,function(err,response){
                            if (err){
                                templates.sendErrorResponse(res,"There was an error getting info from yahoo","Please try again later");
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
            templates.invalidSession(req,res);
            return;
        }
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


function handleApiCallback(req,res){
    var dataFromYahooCallback = qs.parse(nodeurl.parse(req.url).query);     
           
        // find token_secret in db
    client.get("fantasy:oauth:"+dataFromYahooCallback.oauth_token,function(err,result){
        if (err){
            appMonitor("error","failed to find token in database. step 2 of oauth")
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later","err 001");
            return
        } else {
            var storedData = JSON.parse(result);
            oauth.getAccess(dataFromYahooCallback,storedData,function(err,oauthResponse){
                if (err){
                    templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 002");
                    console.log('***** there was an error *****');
                    console.log(err);
                } else {
                    client.get("fantasyuser:"+storedData.username,function(db_err,dat){
                        if (db_err){
                            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 003");
                        } else {
                            var userdata = JSON.parse(dat);
                            console.log('oauthResponse');
                            console.log(oauthResponse);

                            if (typeof oauthResponse.oauth_problem != null){
                                templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 004");
                            } else {
                                storeOauthData(userdata,oauthResponse);
                                res.writeHead(302, { 'Location': 'dashboard?user='+storedData.username+'&sess='+session_val });
                                res.end();
                            }                       
                        }
                    });
                }
            });                         
        }
    });    
}

function storeOauthData(userdata,oauthResponse){
    userdata.oauth_access_token = oauthResponse.oauth_token;
    userdata.oauth_access_token_secret = oauthResponse.oauth_token_secret;
    userdata.oauth_session_handle = oauthResponse.oauth_session_handle;
    userdata.xoauth_yahoo_guid = oauthResponse.xoauth_yahoo_guid;
    client.set("fantasyuser:"+storedData.username,JSON.stringify(userdata),function(err){
        if (err){
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later");
        } else {
            var session_key = "session:"+storedData.username;
            slackr_utils.requestHash(function(session_val){
                client.set(session_key, session_val, function () {
                client.expire(session_key, 1800);
                
                client.del("fantasy:oauth:"+dataFromYahooCallback.oauth_token);
                return;
                });
            });
        }
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
                    slackr_utils.requestHash(function (session_val) {
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
            });
        } else {
            templates.sendErrorResponse(res,'You were logged in? Maybe your session expired','')
			return;
        }
    });
}

	// creates user in database and begins oauth process, sends link to yahoo auth page if successful
function createUser(req, res, data) {
	var uname = "fantasyuser:" + data.signup_uname;
    client.exists(uname, function (ex, r) {
        console.log(r);
        if (r == 1) {
        	templates.sendErrorResponse(res,"Account already exists for "+data.signup_uname,"Please try a different username")
		return;
        } else {
            slackr_utils.requestHash(function (hash_salt) {
                var hashed_pass_and_salt = crypto.createHash('md5').update(data.signup_pass + hash_salt).digest('hex');
                oauth.getToken(function(oauth_err,oauth){
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
		                    	templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later");
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
		            	templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later");
		            	return;
		            }
                });
            });
        }
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
 
 
 	// handles incoming http requests
function handler(req,res){
    req.url = req.url.replace('/FantasyAutomate', '');
    var p = nodeurl.parse(req.url).pathname;
    console.log(req.url,p);
 
	if (p == '/apicallback'){
        	handleApiCallback(req,res);
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
        serveStatic.serveStatic(req,res);
        return
    }
}
 
http.createServer(handler).listen(8133)
