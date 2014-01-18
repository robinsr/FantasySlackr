var http =          require('http'),
    https =         require('https'),
    fs =            require('fs'),
    path =          require('path'),
    crypto =        require('crypto'),
    nodeurl =       require('url'),
    qs =            require('qs'),
    utils =         require('util'),
    serveStatic =   require('./serveStatic'),
    slackr_utils =  require('./slackr_utils'),
    db =            require('./util/dbModule'),
    async =         require('async'),
    app =           http.createServer(handler),
    User =          require('./objects/user').User,
    Team =          require('./objects/team').Team;



function respondInsufficient(req,res){
    res.writeHead(400, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({error:"Invalid Session"}));
}

/*
 *  ==================                 ==================
 *  ==================  Oauth Step 1   ==================
 *  ==================                 ==================
 *  creates user in database and begins oauth process, sends link to yahoo auth page if successful
 */ 
function createUser(req, res, userdata) {
    slackr_utils.checkdata(req,res,["uname","upass","uemail","invite"],userdata,function(){
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
    fs.readFile('./public/resources/closewindow.html',function(err,content){
        res.writeHead(200);
        res.end(content.toString());
    });
    
    var yahooCb = qs.parse(nodeurl.parse(req.url).query);  

    new User({request_token: yahooCb.oauth_token},function(args){
        var newUser = this;
        newUser.getAccess(function(args){
            newUser.getLatestXml(function(args){
                if (args.keys){
                    async.each(args.keys,function(key,cb){
                        new Team({owner: message.user, team_key: key},function(args){
                            this.save(function(){
                                cb(null)
                            })
                        })
                    },function(){
                        newUser.initial_setup = 'complete';
                        newUser.save(function(){
                            //???
                        })
                    })
                } else {
                    newUser.initial_setup = 'complete';
                    newUser.save(function(){
                        //???
                    })
                }
            });
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
function respondOk(req,res,data){
    var ret = {
        success: "Method not implemented yet",
        submitted_data: data
    }
    res.writeHead(200, {'Content-Type':'application/json'});
    res.end(JSON.stringify(ret));
}
function getUserData(req,res,data){
    slackr_utils.checkdata(req,res,["uname","session"],data,function(){
        new User({uname:data.uname},function(){
            this.validateSession(data.session,
            function(){
                respondInsufficient(req,res);
            },function(){
                this.stringifyData(function(err,data){
                    if (!err){
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify(data));
                    } else {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({error: err.message}));
                    }
                })
            })
        })
    })
}
 
    // handles incoming http requests
function handler(req,res){
    req.url = req.url.replace(/(\/dev|\/fantasyslackr)*/i,'');
    if (req.url.match(/\/apicallback/)){
        handleApiCallback(req,res);
    } else if (req.url.match(/\/method\//)){
        var method = req.url.match(/\/method\/([\w]*)\/?/);
        slackr_utils.ajaxBodyParser(req, function(data){
            if (method[1] =='login'){
                login(req,res,data);
            } else if (method[1] =='logout'){
                logout(req,res,data);
            } else if (method[1] =='createNewUser'){
                createUser(req,res,data);
            } else if (method[1] =='getUserData'){
                getUserData(req,res,data);
            } else if (method[1] =='dropPlayer'){
                respondOk(req,res,data);
            } else if (method[1] =='pickupPlayer'){
                respondOk(req,res,data);
            } else if (method[1] =='modifyLineup'){
                respondOk(req,res,data);
            } else if (method[1] =='getFreeAgents'){
                respondOk(req,res,data);
            } else if (method[1] =='getPlayersOnWaivers'){
                respondOk(req,res,data);
            } else if (method[1] =='submitWaiversClaim'){
                respondOk(req,res,data);
            } else if (method[1] =='getWaiversClaim'){
                respondOk(req,res,data);
            } else if (method[1] =='checkValue'){
                db.checkValue(req,res,data);
            } else if (method[1] =='test'){
                console.log('test method')
            }
        });
    } else  {
        serveStatic.serveStatic(req,res);
    }
}

process.on('uncaughtException',function(err){
    var data = new Date().toString() + " : " + err +'\n';
    var pathName = path.join(__dirname,'logs','unhandled.log');
    fs.appendFile(pathName,data,function(){
        console.error("Exiting!")
        process.exit();
    });  
})

if (process.argv[2] == '-d'){
    app.listen(8125)
    console.log('Dev - listening on 8125')
} else {
    app.listen(8133);
    console.log('Prod - listening on 8133')
}

