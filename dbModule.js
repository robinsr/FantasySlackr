var redis = require('redis'),
	client = redis.createClient(),
	slackr_utils = require('./slackr_utils'),
	databaseUrl = "fantasyslackr",
	collections = ["users", "players", "teams", "metadata"],
	db = require("mongojs").connect(databaseUrl, collections),
	utils  = require('util');

	dbConventions = {
	"session":"fantasySession:",
	"temp":"fantasyTempOauth:"
};


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
	db.users.update({name:username},{ $set:	data},function(err){
		if (err) {
			cb(1);
			return
		} else {
			cb(null);
			return
		}
	});
}

module.exports.getFromUserDb = function(username,cb){
	db.users.findOne({name:username},function(err,c){
       if (err){
       	cb(1);
       	return
       } else {
       	cb(null,c);
       	return;
       }
	});
}
module.exports.updateUsersTeams = function(username,team){
	db.users.update({name:username},{$addToSet:{'teams': team}});
}
module.exports.addToTeams = function(team){
	db.teams.insert(team);
}
module.exports.getTeam = function(id,cb){
	db.teams.findOne({_id:id},function(err,c){
		if (err){
       	cb(1);
       	return
       } else {
       	cb(null,c);
       	return;
       }
   })
}
module.exports.addPlayerToTeam = function(team,player){
	db.teams.findOne({team_id:team},{$set: player});
}
module.exports.queryMetadata = function(username,cb){
	var action = {called_for_user:username};
	db.metadata.find(action,function(err){
	if (err){
       	cb(1);
       	return
       } else {
       	cb(null,c);
       	return;
       }
	});
}

	// SESSIONS AND REQUEST TOKENS ARE STORED IN REDIS

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

module.exports.createSession = function(username,token,secret,cb){
	slackr_utils.requestHash(function(hash){
		var dat = {
			session: hash,
			token: token
		}
		client.set(dbConventions['session']+username,hash,function(err){
			if (err){
				cb(1)
			} else {
				cb(null,hash);		
			}
		});
	})
}

module.exports.destroySession = function(username,cb){
	client.del(dbConventions['session']+username);
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
        client.exists(dbConventions['session'] + n, function (ex, r) {
            if (r === 0) {
                cb(false);
                return;
            } else {
                client.get(dbConventions['session'] + n, function (err, r) {
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

module.exports.apiRequestCounter = function(level){
	var d = new Date();
	var namefield = d.getFullYear().toString() + ":" + (d.getMonth()+1).toString() + ":" + level;
	var action = {};
	action[namefield] = 1;
	db.metadata.update({name:"apireqs"},{$inc: action});
}

module.exports.sampleResponses = function(obj){
	db.metadata.insert(obj);
}