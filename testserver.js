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
    db = require('./dbModule'),
    jsonpath = require('JSONPath'),
    objectid = require('mongodb').ObjectID,
    obj = require('./objects');

    var apiUrls = {
        users: 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games?format=json',
        game: 'http://fantasysports.yahooapis.com/fantasy/v2/game/',  // add game_key
        league: 'http://fantasysports.yahooapis.com/fantasy/v2/leagues?format=json',
        team: 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/teams?format=json',
        rosterA:'http://fantasysports.yahooapis.com/fantasy/v2/team/',
        rosterB:'/roster'
    }
    


function respondInsufficient(req,res){
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error:"Invalid Session"}));
}

function test(req, res, userdata){
    console.log('testing');
    db.validateSession(userdata.uname,userdata.session,function(valid){
        if (valid){
            initialSetup(userdata.uname,function(da){
                console.log(da.length);
                res.writeHead(200);
                res.end(JSON.stringify(da));
            });
            //db.getFromUserDb(userdata.uname,function(err,user_object){
                // if (err){
                //     res.writeHead(500, {"Content-Type" : "application/json"});
                //     res.end(JSON.stringify({error: "DB Could Not Find User\'s Data"}));
                // } else {
                //     checkUsersTokenExp(user_object,function(err,token,secret){
                //         // GET GAME KEY (nfl 2013 is 314)
                //         oauth.getYahoo(userdata.url,token,secret,function(err,result){
                //             if (err){
                //                 res.writeHead(500, {"Content-Type" : "application/json"});
                //                 res.end(JSON.stringify({error: "Could Not Get User\'s Data"}));
                //             } else {
                //                 var sample = {
                //                     _id: new objectid(),
                //                     url:userdata.url,
                //                     resource: userdata.resource,
                //                     called_for_user: userdata.uname,
                //                     response: JSON.parse(result)
                //                 }
                //                 db.sampleResponses(sample);
                //                 var dbEntry = 'db.metadata.find({_id:ObjectId("'+sample._id.toString()+'")})';
                //                 res.writeHead(200, {"Content-Type" : "application/json"});
                //                 res.end(dbEntry);
                //             }
                //         });
                //     })
                // }
            //})
        } else {
            respondInsufficient(req,res);
        }
    })
}
function initialSetup(username,cb){
    setupTeams(username,function(){
        setupRoster(username,function(){
            cb()
        })
    })
}
function setupRoster(username,cb){
    db.getFromUserDb(username,function(err,user_object){
        if (err){
            return
        } else {
            checkUsersTokenExp(user_object,function(err,token,secret){
                user_object.teams.forEach(function(key){
                    console.log(key)
                    db.getTeam(key,function(err,team){
                        var url = 'http://fantasysports.yahooapis.com/fantasy/v2/team/'+team.team_id+'/roster?format=json';
                        oauth.getYahoo(apiUrls.team,token,secret,function(err,result){
                            if (err){
                                console.log('err getting roster '+team.team_id)
                            } else {
                                var response = JSON.parse(result);
                                var sample = {
                                    _id: new objectid(),
                                    url:url,
                                    resource: "roster",
                                    called_for_user: username,
                                    response: response
                                }
                                db.sampleResponses(sample);

                                if (jsonpath.eval(response,'$..team').length > 0){
                                    for (i=0;i<jsonpath.eval(response,'$..team').length;i++){
                                        var thisTeam = jsonpath.eval(response,'$..team')[i]
                                        var players = jsonpath.eval(thisTeam,'$..player');
                                        for (ii=0;ii<players.length;ii++){
                                            var thisPlayer = new obj.player(new objectid,
                                                players[ii].player_key,
                                                players[ii].name.full,
                                                players[ii].name.first,
                                                players[ii].name.last,
                                                players[ii].eligable_positions[0].position,
                                                /* inj stat */'unknown',
                                                players[ii].bye_weeks.week);
                                            db.addPlayerToTeam(thisTeam.team_key,thisPlayer);
                                        }
                                        if (i >= jsonpath.eval(response,'$..team').length - 1){
                                            cb()
                                        }
                                    }
                                }
                            }
                        });
                    })
                })
            })
        }
    })
}
function setupTeams(username,cb){
    db.getFromUserDb(username,function(err,user_object){
        if (err){
            return
        } else {
            checkUsersTokenExp(user_object,function(err,token,secret){
                oauth.getYahoo(apiUrls.team,token,secret,function(err,result){
                    if (err){
                        return
                    } else {
                        var response = JSON.parse(result);
                        var sample = {
                            _id: new objectid(),
                            url:apiUrls.team,
                            resource: "games/teams",
                            called_for_user: username,
                            response: response
                        }
                        db.sampleResponses(sample);

                        if (jsonpath.eval(response,'$..team').length > 0){
                            for(i=0;i<jsonpath.eval(response,'$..team').length;i++){
                                var thisTeam = jsonpath.eval(response,'$..team')[i];
                                var _id = new objectid();
                                var newTeam = new obj.team(_id,user_object._id,jsonpath.eval(thisTeam,'$..team_key')[0],jsonpath.eval(thisTeam,'$..name')[0]);
                                db.addToTeams(newTeam);
                                if (i >= jsonpath.eval(response,'$..team').length - 1){
                                    cb();
                                }
                            }
                        }
                    }
                });
            })
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

    if ((typeof token_ex == 'undefined') || (now > token_ex)){
        console.log('getting new access token. typeof is '+typeof token_ex+' , now is '+now+' , token ex is '+token_ex);
        oauth.refreshToken(token,secret,handle,function(err,newtoken,newsecret,result){
            if (err) {
                cb(1);
            } else {
                storeAccessResult(user_object.name,newtoken,newsecret,result);
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
	
	req.url = req.url.replace('/FantasySlackr', '');
    req.url = req.url.replace('/fantasyslackr', '');
    var p = nodeurl.parse(req.url).pathname;
    var p1 = p.split('/')[1];

    if (p == '/'){
        serveStatic.serveStatic(req,res);
        return;
    } else if (p == '/apicallback'){
    	handleApiCallback(req,res);
    	return;
    } else if (p == '/test'){
        slackr_utils.ajaxBodyParser(req,function(data){
            test(req,res,data);
        });
        return  
    } else if (p == '/method/login'){
        slackr_utils.ajaxBodyParser(req,function(data){
            login(req,res,data);
        });
        return
    } else if (p == '/method/logout'){
        slackr_utils.ajaxBodyParser(req,function(data){
            logout(req,res,data);
        });
        return
    } else if (p == '/method/createNewUser'){
        slackr_utils.ajaxBodyParser(req,function(data){
            createUser(req,res,data);
        });
        return
    } else if (p == '/method/getUserData'){
        slackr_utils.ajaxBodyParser(req,function(data){
            fetchUsersLineup(req,res,data);
        });
        return
    } else if (p == '/method/dropPlayer'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/pickupPlayer'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/modifyLineup'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/getFreeAgents'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/getPlayersOnWaivers'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/submitWaiversClaim'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else if (p == '/method/getWaiversClaim'){
        slackr_utils.ajaxBodyParser(req,function(data){
            respondOk(req,res,data);
        });
        return
    } else {
        res.writeHead(404, {"Content-Type":"text/plain"});
        res.end("Method "+p+" does not exist");
        return
    }
}
http.createServer(handler).listen(8133)

