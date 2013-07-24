var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    querystring = require('querystring'),
    crypto = require('crypto')
    nodeurl = require('url')
    qs = require('qs'),
    mu = require('mu2'),
    utils = require('util'),
    serveStatic = require('./serveStatic'),
    slackr_utils = require('./slackr_utils'),
    templates = require('./templates'),
    //oauth = require('./oauth'),
    oauth = require('./oauthtest'),
	appMonitor = require('./appMonitor'),
    db = require('./dbModule');

mu.root = __dirname + '/'
 

function constructDashboard(req,res){
	var query = qs.parse(nodeurl.parse(req.url).query);
	db.validateSession(query.user,query.sess,function(sessionValid){
		if (sessionValid){
            db.getFromUserDb(query.user,function(err,result){
                if (err || (result == null)){
                    templates.sendErrorResponse(res,"We're having some problems.","Please try again later.","err010");
					appMonitor.sendMessage("error","err010, db read error");
                } else {
                    var userData = JSON.parse(result);
                    if (userData.oauth_access_token && userData.oauth_access_token_secret){
                        t = userData.access_token;
                        ts = userData.access_token_secret;

                        oauth.getYahoo('http://fantasysports.yahooapis.com/fantasy/v2/league/314.l.148766',t,ts,function(err,response){
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








	// exchanges req token and tok verifier for access token 
function handleApiCallback(req,res){
    var yahooCb = qs.parse(nodeurl.parse(req.url).query);     
           
        // find token_secret in db
    db.getTemporaryToken(yahooCb.oauth_token,function(err,result){
        if (err){
            appMonitor.sendMessage("error","failed to find token in database. step 2 of oauth")
            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later","err 001 - db error");
			appMonitor.sendMessage("error","err001, failed to find token in database");
            return
        } else {
            var storedData = JSON.parse(result);


    // GETS OAUTH ACCESS TOKEN

            // begin brevity...
            var getT = yahooCb.oauth_token,
                getV = yahooCb.oauth_verifier,
                getS = storedData.oauth_token_secret;
            // end brevity

            appMonitor.sendMessage('debug','secret going to getAccess: '+getS);

            oauth.getAccess(getT,getV,getS,function(err,token,secret,result){
                if (err){
                    templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 002 - oauth connection problem");
					appMonitor.sendMessage("error","err002, oauth connection problem");
                    console.log('***** there was an error *****');
                    console.log(err);
                } else {

    // STORES OAUTH ACCESS TOKEN
                    var newdata = {
                        access_token = token;
                        access_token_secret = secret;
                        session_handle = result.oauth_session_handle;
                        guid = result.xoauth_yahoo_guid;
                    }

                    db.updateUserDb(storedData.username,newdata,function(db_err,dat){
                        if (db_err){
                            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 003 - db error");
							appMonitor.sendMessage("error","err003, redis could not get users info");
                        } else {

    // CREATES SESSION 
                            db.createSession(function(session_val){
    // REDIRECTS

                                res.writeHead(302, { 'Location': 'dashboard?user='+storedData.username+'&sess='+session_val });
                                res.end(); 
                            });                    
                        }
                    });
                }
            });                         
        }
    });    
}

	// sets session keys for users and (in future) get new oauth token
function login(req, res, data) {
    var p = /[0-9a-f]{32}/
    var uname = "fantasyuser:" + data.uname;

    // GETS USER OBJECT FROM DB

    db.getFromUserDb(data.uname,function(err, r) {
        if (err) {
            console.log('error');
			templates.sendErrorResponse(res,"There was an error logging into your account","Please try again later", "err 008");
			appMonitor.sendMessage("error","login, redis could not get user data");
        } else {

    // CHECKS IF PASSWORD MATCHES HASH
            if (r !== null) {
                var user_object = JSON.parse(r);
                var return_object = {};
                var concat_pass = data.pass + user_object.salt;
                var hashed_pass = crypto.createHash('md5').update(concat_pass).digest('hex');
                if (hashed_pass == user_object.pass) {

    // SETS SESSION - needs token to set session

                    db.createSession(uname,token,function(session_val){
                        return_object.sessionid = session_val;
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(return_object));
                        return;
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
    db.destroySession(query.n,function(er){
        if (er){
            template.sendErrorResponse(res,"Uh-Oh","Something went wrong","","err 013");
            return
        } else {
            templates.logout(res);
            return
        }
    });        
}

	// creates user in database and begins oauth process, sends link to yahoo auth page if successful
function createUser(req, res, uname, upass, uemail) {

    // check if user already exists
  db.checkIfUserExists(uname, function (ex, r) {
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
            db.setTemporaryToken(oauth_token,oauth_token_secret,uname);

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

            // store user object
            db.addToUserDb(uname, JSON.stringify(user_setup), function (err, rr) {

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
                templates.success(res,d);
                return;
              }
            });
          }
        });
      });
    }
  });
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
function ajaxLogin(req,res){
    var bodyText = '';
    req.on('data',function(chunk){
        bodyText += chunk;
    })
    req.on('end',function(){
        var userdata = JSON.parse(bodyText);

        db.getFromUserDb(userdata.name,function(err,c){
            if (err) {
                res.writeHead(500);
                res.end("no user account found")
            } else {
                slackr_utils.requestHash(function(hash){
                    var dat = {
                        session: hash
                    }
                })
                res.writeHead(200);
                res.end(JSON.stringify(dat));
            }
        })

        
        userdata.name
        userdata.password
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

    } else if (p == '/method/login'){
        console.log("ajax call to login");
        login(req,res);
        return
        
    } else {
        serveStatic.serveStatic(req,res);
        return
    }
}
 
http.createServer(handler).listen(8133)
