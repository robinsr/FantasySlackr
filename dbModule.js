var redis = require('redis'),
	client = redis.createClient(),
	slackr_utils = require('./slackr_utils'),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players"],
	db = require("mongojs").connect(databaseUrl, collections),

	dbConventions = {
	"user":"fantasyUser:",
	"session":"fantasySession:",
	"token":"fantasyToken:",
	"temp":"fantasyTempOauth:"
};

module.exports.setTemporaryToken = function (token,secret,username){
	var set = {
		oauth_token_secret: secret,
		username: username
	}
	client.set(dbConventions["temp"]+token,JSON.stringify(set),function(err,r){});
	client.expire(dbConventions["temp"]+token, 1800);
}
module.exports.getTemporaryToken = function (token,cb){
	client.get(dbConventions["temp"]+token,function(err,c){
		if (err) {
			cb(1);
			return
		} else {
			cb(null,c);
			return
		}
	})
}

module.exports.addToUserDb = function(userdata,cb){
	db.users.insert(userdata,function(err,saved){
       if (err || !saved){
       	cb(1);
       	return
       } else {
       	cb(null);
       	return;
       }
	});
}

module.exports.removeFromUserDb = function(username,cb){
	db.users.remove({name:username},function(err,deleted){
		if (err || !deleted){
			cb(1);
       	return
       } else {
       	cb(null,c);
       	return;
       }
	});
}

module.exports.updateUserDb = function(username,data,cb){
	db.users.update({name:username},{ $set:	{access_token: data.access_token}},function(){
		db.users.update({name:username},{ $set: {access_token_secret: data.access_token_secret}},function(){
			db.users.update({name:username},{ $set: {session_handle: data.session_handle}},function(){
				db.users.update({name:username},{ $set: {guid: data.guid}},function(err){
					if (err) {
						cb(1);
						return
					} else {
						cb(null);
						return
					}
				});
			});
		});	
	});
}

module.exports.getFromUserDb = function(username,cb){
	client.get(dbConventions["user"]+username,function(err,c){
       if (err){
       	cb(1);
       	return
       } else {
       	cb(null,c);
       	return;
       }
	});
}

module.exports.checkIfUserExists = function(username,cb){
	db.users.findOne({name:username},function(err,result){
		if (err){
       	cb(1);
       	return
       } else if (result != null){
       	cb(null,1);
       } else {
       	cb(null,0);
       	return;
       }
	});
}


module.exports.createSession = function(username,token,cb){
	slackr_utils.requestHash(function(hash){
		var dat = {
			session: hash,
			token: token
		}
		client.set(dbConventions['session']+username,hash,function(err){
			if (err){
				cb(1)
				return
			} else {
				client.set(dbConventions['token']+username,token,function(err){
					if (err){
						cb(1)
						return
					} else {
						client.expire(dbConventions['token']+username,3500);
						cb(null,hash);
						return
					}
				});
			}
		});
	})
}

module.exports.destroySession = function(username,cb){
	client.del(dbConventions['session']+username);
	client.del(bConventions['token']+username);
	cb(null);
}

module.exports.validateSession = function (n, s, cb) {
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

