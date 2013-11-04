var http =          require('http'),
    https =         require('https'),
    fs =            require('fs'),
    crypto =        require('crypto'),
    nodeurl =       require('url'),
    qs =            require('qs'),
    utils =         require('util'),
    serveStatic =   require('./serveStatic'),
    slackr_utils =  require('./slackr_utils'),
    appMonitor =    require('./appMonitor'),
    db =            require('./util/dbModule'),
    objectid =      require('mongodb').ObjectID,
    xpath =         require('xpath'), 
    dom =           require('xmldom').DOMParser,
    obj =           require('./objects'),
    async =         require('async'),
    game =          require('./gameMethods'),
    app =           http.createServer(handler),
    User =          require('./objects/user').User;


function respondInsufficient(req,res){
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error:"Invalid Session"}));
}


function getUserData(req,res,data){
    slackr_utils.checkdata(req,res,["uname","session",],data,function(){
        new User({uname:data.uname},function(){
            this.validateSession(data.session,
            function(){
                respondInsufficient(req,res);
            },function(){
                this.stringifyData(function(err,data){
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(data));
                })
            })
        })
    })
}

function logout(req,res,data) {
    new User({uname: data.uname},function(args){
        this.destroySession(function(ars){
            if (args.err){
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:args.err.message}));
            } else {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: "logged out" }));
            }
        });
    });   
}

/*
 *  ==================                 ==================
 *  ==================  Oauth Step 1   ==================
 *  ==================                 ==================
 *  creates user in database and begins oauth process, sends link to yahoo auth page if successful
 */ 
function createUser(req, res, userdata) {
    slackr_utils.checkdata(req,res,["uname","upass","uemail"],userdata,function(){
        new User(userdata,function(args){
            var self = this;
            if (self.pass != null){
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:"User Account Already Exists"}));
            } else {
                self.create(userdata,function(args){
                    if (args.err){
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({error:args.err.message}));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ uname: userdata.uname, url: self.xoauth_request_auth_url }));
                    } 
                });
            }
        });
    });
}
/*
 *  ==================                 ==================
 *  ==================  Oauth Step 2   ==================
 *  ==================                 ==================
 *  exchanges req token and tok verifier for access token
 */ 
function handleApiCallback(req,res){
    fs.readFile('./resources/closewindow.html',function(err,content){
        res.writeHead(200);
        res.end(content.toString());
    })
    
    var yahooCb = qs.parse(nodeurl.parse(req.url).query);  

    new User({request_token: yahooCb.oauth_token},function(args){
        this.getAccess(function(args){
            this.setup();
        })
    })
}

function login(req,res,userdata){
    slackr_utils.checkdata(req,res,["uname","upass"],userdata,function(){
        new User(userdata,function(args){
            console.log(this);
            if (args.err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:args.err.message}));
                return
            } else if (this.pass == null) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'No User Account Found'}));
                return
            } else if (this.pass != crypto.createHash('md5').update(userdata.upass + this.salt).digest('hex')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Invalid Password'}));
                return
            } else if (typeof this.initial_setup == 'undefined'){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Error Creating Account'}));
                return
            } else if (this.initial_setup == 'guid taken'){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Yahoo ID already in use'}));
                return
            } else if (this.initial_setup == 'error'){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.strin5ify({error:'Error Fetching Users Yahoo data'}));
                return
            } else if (typeof this.access_token == 'undefined'){
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({error:'Unauthenticated User'}));
                return
            } else {
                this.refreshToken(function(args){
                    if (args.err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({error: 'Could Not Refresh Token'}));
                        return
                    } else {
                        this.makeSession(function(args){
                            if (args.err) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({error: 'could not create session'}));
                                return
                            } else {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({session:args.hash}));
                                return
                            }
                        });
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
    console.log(req.url);
    
    req.url = req.url.replace('/dev','');
    req.url = req.url.replace('/FantasySlackr', '');
    req.url = req.url.replace('/fantasyslackr', '');
    var p = nodeurl.parse(req.url).pathname;
    var p1 = p.split('/')[1];

    if (p == '/'){
        serveStatic.serveStatic(req,res);
        return;
    } else if (p == '/apicallback' || p == '/apicallback/'){
        handleApiCallback(req,res);
        return;
    } else if (p == '/test'){
        db.testQuery(function(err){
            if (err){
                res.writeHead(400);
                res.end();
            } else {
                res.writeHead(200);
                res.end();
            }
        })
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
            getUserData(req,res,data);
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
    } else if (p == '/method/checkValue'){
        slackr_utils.ajaxBodyParser(req,function(data){
            db.checkValue(req,res,data);
        });
        return
    } else if (p == '/method/test'){
        slackr_utils.ajaxBodyParser(req,function(data){
            res.writeHead(200);
            res.end(JSON.stringify(data))
        })
        
        return
    }else {
        serveStatic.serveStatic(req,res);
        return;
    }
}

if (process.argv[2] == '-d'){
    app.listen(8125)
    console.log('Dev - listening on 8125')
} else {
    app.listen(8133);
    console.log('Prod - listening on 8133')
}

