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

            oauth.getAccess(getT,getV,getS,function(err,token,secret,result){
                if (err){
                    templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 002 - oauth connection problem");
					appMonitor.sendMessage("error","err002, oauth connection problem");
                    console.log('***** there was an error *****');
                    console.log(err);
                } else {

    // STORES OAUTH ACCESS TOKEN
                    var newdata = {
                        access_token: token,
                        access_token_secret: secret,
                        session_handle: result.oauth_session_handle,
                        guid: result.xoauth_yahoo_guid
                    }

                    db.updateUserDb(storedData.username,newdata,function(db_err){
                        if (db_err){
                            templates.sendErrorResponse(res,"There was an error setting up your account","Please try again later", "err 003 - db error");
							appMonitor.sendMessage("error","err003, redis could not get users info");
                        } else {

    // CREATES SESSION 
                            db.createSession(storedData.username,token,function(err,session_val){
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

	var expectedData = ["uname","upass","uemail"];

	expectedData.forEach(function(piece){
		if (typeof userdata[piece] == 'undefined'){
			res.writeHead(400, {'Content-Type':'application/json'});
			res.end("request parameter missing: "+piece);
			return
		}
	});

	var hashed_pass_and_salt = crypto.createHash('md5').update(upass + slackr_utils.requestHashAsync(32)).digest('hex');

    // check if user already exists
  	db.getFromUserDb(uname, function (ex, r){
	    if (err) {
	        res.writeHead(500, { 'Content-Type': 'application/json' });
	        res.end(JSON.stringify({error:'Database Error'}));
	        return
	    } else if (r == 1) {
	    	res.writeHead(400, { 'Content-Type': 'application/json' });
	        res.end(JSON.stringify({error:'Account already exists for '+uname}));
	        return
    	} else {
	        oauth.getToken(function(oauth_err,oauth_token,oauth_token_secret,oauth_url){
	          	if (oauth_err != null){
		            res.writeHead(500, { 'Content-Type': 'application/json' });
			        res.end(JSON.stringify({error:'Oauth Error'}));
			        return
	          	} else {
	            	// store request token, token secret, and username for later lookup
		            db.setTemporaryToken(oauth_token,oauth_token_secret,uname);

		            // create user object to be stored
		            var user_setup = {
		              name: uname,
		              email: uemail,
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
                			res.end(JSON.stringify({ uname: uname, url: oauth_url }));
              			}
            		});
          		}
    		});
      	}
	});
}


function login(req,res,userdata){

	var expectedData = ["uname","upass"];

	expectedData.forEach(function(piece){
		if (typeof userdata[piece] == 'undefined'){
			res.writeHead(400, {'Content-Type':'application/json'});
			res.end("request parameter missing: "+piece);
			return
		}
	});

    db.getFromUserDb(userdata.uname,function(err,user_object){

    	var token = user_object.access_token,
            secret = user_object.access_token_secret,
            handle = user_object.session_handle;

        if (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({error:'Database Error'}));
            return
        } else if (user_object == null) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({error:'No User Account Found'}));
            return
        } else if ((userdata.pass+user_object.salt) != crypto.createHash('md5').update(concat_pass).digest('hex')) {
        	res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({error:'Invalid Password'}));
            return
        } else if (token == 'undefined' || secret  'undefined' || handle == 'undefined'){
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({error:'Unauthenticated User'}));
            return
        } else {
        	oauth.refreshToken(token,secret,handle,function(err,token,secret,result){
                if (err){
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({error: 'could not refresh token'}));
                    return
                } else {
                    db.createSession(user_object.name,token,function(err,hash){
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
                }
            });
        }
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

	    if (p == '/apicallback'){
        	handleApiCallback(req,res);
        	return;
	    } else if (p == '/method/login'){
	        login(req,res,data);
	        return
	    } else if (p == '/method/createNewUser'){
	        createUser(req,res,data);
	        return
        } else if (p == '/method/getUserData'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/dropPlayer'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/pickupPlayer'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/modifyLineup'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/getFreeAgents'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/getPlayersOnWaivers'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/submitWaiversClaim'){
	        respondOk(req,resd,ata);
	        return
	    } else if (p == '/method/getWaiversClaim'){
	        respondOk(req,resd,ata);
	        return
	    } else {
	        res.writeHead(400);
	        res.end({error:"invalid method"});
	    }
	});
}
http.createServer(handler).listen(8133)
