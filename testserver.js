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
    oauth = require('./oauth'),
	appMonitor = require('./appMonitor');

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




function constructDashboard(req,res){
	var query = qs.parse(nodeurl.parse(req.url).query);
	validateSession(query.user,query.sess,function(sessionValid){
		if (sessionValid){
            client.get('fantasyuser:'+query.user,function(err,result){
                if (err || (result == null)){
                    templates.sendErrorResponse(res,"We're having some problems.","Please try again later.","err010");
					appMonitor.sendMessage("error","err010, db read error");
                } else {
                    var userData = JSON.parse(result);
                    if (userData.oauth_access_token && userData.oauth_access_token_secret){
                        t = userData.oauth_access_token;
                        ts = userData.oauth_access_token_secret;

                        oauth.callYahoo('http://fantasysports.yahooapis.com/fantasy/v2/league/314.l.148766','GET',t,ts,function(err,response){
                            if (err){
                                templates.sendErrorResponse(res,"There was an error getting info from yahoo","Please try again later","err009");
								appMonitor.sendMessage("error","err009, error getting info from yahoo");
                            } else {
                                res.writeHead(200);
                                res.end(utils.inspect(response));
                            }
                        });
                    } else {
                    	templates.sendGenericMessage(res
                    		,"We still need something from you"
                    		,"You have not allowed us access to your Yahoo Fantasy Sports account."
                    		,"<p>Click <a href='/FantasyAutomate/grantAccess?name="+query.user+"&sess="+query.sess+"'>here</a> to authorize with Yahoo</p>");
            		return;
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
            appMonitor.sendMessage("error","failed to find token in database. step 2 of oauth")
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later","err 001 - db error");
			appMonitor.sendMessage("error","err001, failed to find token in database");
            return
        } else {
            var storedData = JSON.parse(result);
            oauth.getAccess(dataFromYahooCallback,storedData,function(err,oauthResponse){
                if (err){
                    templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 002 - oauth connection problem");
					appMonitor.sendMessage("error","err002, oauth connection problem");
                    console.log('***** there was an error *****');
                    console.log(err);
                } else {
                    client.get("fantasyuser:"+storedData.username,function(db_err,dat){
                        if (db_err){
                            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 003 - db error");
							appMonitor.sendMessage("error","err003, redis could not get users info");
                        } else {
                            var userdata = JSON.parse(dat);
                            console.log('oauthResponse');
                            console.log(oauthResponse);

                            if (typeof oauthResponse.oauth_problem != null){
                                templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 004 - oauth problem");
								appMonitor.sendMessage("error","err004, yahoo responded with oauth_problem");
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
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 005");
			appMonitor.sendMessage("error","err005, redis could not store users oauth");
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
    });
}

	// sets session keys for users and (in future) get new oauth token
function login(req, res, data) {
    var p = /[0-9a-f]{32}/
    var uname = "fantasyuser:" + data.uname;
    client.get(uname, function (err, r) {
        if (err) {
            console.log('error');
			templates.sendErrorResponse(res,"There was an error logging into your account","Please try again later", "err 008");
			appMonitor.sendMessage("error","login, redis could not get user data");
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
        if (err) {
			appMonitor.sendMessage('error','logout1, redis error');
		}
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
function createUser(req, res, uname, upass, uemail) {
  var redisUname = "fantasyuser:" + uname;

    // check if user already exists
  client.exists(redisUname, function (ex, r) {
    if (r == 1) {
      templates.sendErrorResponse(res,"Account already exists for "+uname,"Please try a different username")
      return;
    } else {

      // create salt+hased password
      slackr_utils.requestHash(function (hash_salt) {
        var hashed_pass_and_salt = crypto.createHash('md5').update(upass + hash_salt).digest('hex');

        // request the request token from yahoo
        oauth.getToken(function(oauth_err,oauth_token,oauth_token_secret,oauth_url){
          if (oauth_err != null){
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 006");
			appMonitor.sendMessage('error','err006, getToken responsed with error');
            return;
          } else {

            // store request token, token secret, and username for later lookup
            setTemporaryToken(oauth_token,oauth_token_secret,uname);

            // create user object to be stored
            var user_setup = {
              name: uname,
              email: uemail,
              pass: hashed_pass_and_salt,
              salt: hash_salt,
              oauth_token: oauth_token,
              oauth_token_secret: oauth_token_secret,
              xoauth_request_auth_url: oauth_url
            };

            var udata = JSON.stringify(user_setup);

            // store user object
            client.set(uname, udata, function (err, rr) {

              // send success or error page
              if (err) {
                templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 007");
				appMonitor.sendMessage('error','err007, redis error storing user object');
                return;
              } else {
                var d = {
                  uname: uname,
                  url: oauth_url
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
		var formData = querystring.parse(fullbody);
		var uname = formData.signup_uname;
		var upass = formData.signup_pass;
		var uemail = formData.signup_email;
		createUser(req,res,uname,upass,uemail);
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
