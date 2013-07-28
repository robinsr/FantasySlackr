var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    querystring = require('querystring'),
    crypto = require('crypto')
    nodeurl = require('url')
    qs = require('qs'),
    utils = require('util'),
    serveStatic = require('./serveStatic'),
    slackr_utils = require('./slackr_utils'),
    //oauth = require('./oauth'),
    oauth = require('./oauthtest'),
	appMonitor = require('./appMonitor'),
    db = require('./dbModule');

function respondInsufficient(req,res){
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error:"Invalid Session"}));
}

function fetchUsersLineup(req, res, userdata){
    db.validateSession(userdata.uname,userdata.session,function(valid,token,secret){
        if (valid){
                // GET GAME KEY (nfl 2013 is 314)
            oauth.getYahoo('http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json',token,secret,function(err,result){
                if (err){
                    res.writeHead(400, {"Content-Type" : "application/json"});
                    res.end(JSON.stringify({error: "Could Not Get User\'s Game Data"}));
                } else {
                    var fantasy = JSON.parse(result);
                    console.log(utils.inspect(fantasy.fantasy_content.users['0'].user[1].games['0'].game));
                }
            })
        } else {
            respondInsufficient(req,res);
        }
    })
}

	// exchanges req token and tok verifier for access token 
function handleApiCallback(req,res){
    appMonitor.sendMessage('debud','recevied yahoo callback');
    res.writeHead(200);
    res.end('Got it, thanks');
    var yahooCb = qs.parse(nodeurl.parse(req.url).query);     
           
        // find token_secret in db
    db.getTemporaryToken(yahooCb.oauth_token,function(err,result){
        if (err){
			appMonitor.sendMessage("error","err001, failed to find token in database");
            return
        } else {
            var storedData = JSON.parse(result);
            // GETS OAUTH ACCESS TOKEN
            oauth.getAccess(yahooCb.oauth_token,yahooCb.oauth_verifier,storedData.oauth_token_secret,function(err,token,secret,result){
                if (err){
					appMonitor.sendMessage("error","err002, oauth connection problem");
                } else {
                    // STORES OAUTH ACCESS TOKEN
                    storeAccessResult(storedData.username,token,secret,result);
                    // AT THIS POINT, PINGING login WOULD RETURN A SESSION, NOT "Unauthorized User"
                }
            });                         
        }
    });    
}

function storeAccessResult(username,token,secret,result){
    var newdata = {
        access_token: token,
        access_token_secret: secret,
        access_token_expires : parseInt(new Date().getTime()) + (parseInt(result.oauth_expires_in) * 1000),
        session_handle: result.oauth_session_handle,
        session_handle_expires: parseInt(new Date().getTime()) + (parseInt(result.oauth_authorization_expires_in) * 1000),
        guid: result.xoauth_yahoo_guid
    }
    db.updateUserDb(username,newdata,function(db_err){
        if (db_err){
            appMonitor.sendMessage("error","err003, update user failed");
        } else {
            appMonitor.sendMessage('success','store access result success')
        }
    });
}

function logout(req,res,data) {
    db.destroySession(data.uname,function(er){
        if (er){
            res.writeHead(500, { 'Content-Type': 'application/json' });
	        res.end(JSON.stringify({error:'Error Logging Out'}));
	        return
        } else {
            res.writeHead(200);
			res.end();
        }
    });        
}

	// creates user in database and begins oauth process, sends link to yahoo auth page if successful
function createUser(req, res, userdata) {

    checkdata(req,res,["uname","upass","uemail"],userdata,function(){
        var hash_salt = slackr_utils.requestHashAsync(32);
    	var hashed_pass_and_salt = crypto.createHash('md5').update(userdata.upass + hash_salt).digest('hex');
        console.log(hash_salt);
        console.log(hashed_pass_and_salt);

        // check if user already exists
      	db.getFromUserDb(userdata.uname, function (err, r){
    	    if (err) {
    	        res.writeHead(500, { 'Content-Type': 'application/json' });
    	        res.end(JSON.stringify({error:'Database Error'}));
    	        return
    	    } else if (r) {
    	    	res.writeHead(400, { 'Content-Type': 'application/json' });
    	        res.end(JSON.stringify({error:'Account already exists for '+userdata.uname}));
    	        return
        	} else {
    	        oauth.getToken(function(oauth_err,oauth_token,oauth_token_secret,oauth_url){
    	          	if (oauth_err != null){
    		            res.writeHead(500, { 'Content-Type': 'application/json' });
    			        res.end(JSON.stringify({error:'Oauth Error'}));
    			        return
    	          	} else {
    	            	// store request token, token secret, and username for later lookup
    		            db.setTemporaryToken(oauth_token,oauth_token_secret,userdata.uname);

    		            // create user object to be stored
    		            var user_setup = {
    		              name: userdata.uname,
    		              email: userdata.uemail,
    		              pass: hashed_pass_and_salt,
    		              salt: hash_salt,
    		            };

                		// store user object
                		db.addToUserDb(user_setup, function (err) {
    						if (err) {
    			                res.writeHead(500, { 'Content-Type': 'application/json' });
    					        res.end(JSON.stringify({error:'Database Error'}));
    					        return
    		              	} else {
    		              		res.writeHead(200, { 'Content-Type': 'application/json' });
                    			res.end(JSON.stringify({ uname: userdata.uname, url: oauth_url }));
                  			}
                		});
              		}
        		});
          	}
    	});
    });
}

function checkdata(req,res,expectedData,actualdata,cb){
    var checked = [];
    expectedData.forEach(function(piece){
        if (typeof actualdata[piece] == 'undefined'){
            res.writeHead(400, {'Content-Type':'application/json'});
            res.end("request parameter missing: "+piece);
            return
        } else {
            checked.push(piece);
            if (checked.length == expectedData.length){
                cb();
            }
        }
    });
}
function checkUsersTokenExp(user_object,cb){
    var token = user_object.access_token,
    token_ex = user_object.access_token_expires,
    secret = user_object.access_token_secret,
    handle = user_object.session_handle,
    handle_ex = user_object.session_handle_expires,
    now = new Date().getTime();
    console.log(now);
    console.log(token_ex);

    if ((typeof token_ex == 'undefined') || (now > token_ex)){
        oauth.refreshToken(token,secret,handle,function(err,newtoken,newsecret,result){
            if (err) {
                cb(1);
            } else {
                cb(null,newtoken,newsecret,result);
            }
        });
    } else {
        cb(null,token,secret);
    }
}

function login(req,res,userdata){
    checkdata(req,res,["uname","upass"],userdata,function(){

        db.getFromUserDb(userdata.uname,function(err,user_object){

        	

            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Database Error'}));
                return
            } else if (user_object == null) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'No User Account Found'}));
                return
            } else if (user_object.pass != crypto.createHash('md5').update(userdata.upass + user_object.salt).digest('hex')) {
            	res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Invalid Password'}));
                return
            } else if (typeof user_object.access_token == 'undefined'){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Unauthenticated User'}));
                return
            } else {

                checkUsersTokenExp(user_object,function(err,token,secret,result){
                    if (err){
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({error: 'Could Not Refresh Token'}));
                        return
                    } else {
                        db.createSession(user_object.name,token,secret,function(err,hash){
                            if (err) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({error: 'could not create session'}));
                                return
                            } else {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({session:hash}));
                                return
                            }
                        });
                        if (result){
                            storeAccessResult(user_object.name,token,secret,result);
                            console.log('login, got result, stored newdata');
                        }
                    }
                });
            }
        });
});
}
function respondOk(req,res,data){
	var ret = {
		success: "Method not implemented yet",
		submitted_data: data
	}
	res.writeHead(200, {'Content-Type':'application/json'});
	res.end(JSON.stringify(ret));
}
 
 	// handles incoming http requests
function handler(req,res){
	slackr_utils.ajaxBodyParser(req,function(data){
		req.url = req.url.replace('/FantasyAutomate', '');
	    var p = nodeurl.parse(req.url).pathname;
        var p1 = p.split('/')[1];
        console.log(p1);

	    if (p == '/apicallback'){
        	handleApiCallback(req,res);
        	return;
	    } else if (p == '/method/login'){
	        login(req,res,data);
	        return
        } else if (p == '/method/logout'){
            logout(req,res,data);
            return
	    } else if (p == '/method/createNewUser'){
	        createUser(req,res,data);
	        return
        } else if (p == '/method/getUserData'){
	        fetchUsersLineup(req,res,data);
	        return
	    } else if (p == '/method/dropPlayer'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/pickupPlayer'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/modifyLineup'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/getFreeAgents'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/getPlayersOnWaivers'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/submitWaiversClaim'){
	        respondOk(req,res,data);
	        return
	    } else if (p == '/method/getWaiversClaim'){
	        respondOk(req,res,data);
	        return
	    } else {
	        serveStatic.serveStatic(req,res);
            return
	    }
	});
}
http.createServer(handler).listen(8133)
