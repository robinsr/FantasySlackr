var crypto = require('crypto');
var slackr_utils = require(__dirname + '/../slackr_utils');
var appErr = require(__dirname + '/../util/applicationErrors');
var models = require(__dirname + '/../models');
var databaseUrl = 'fantasyslackr';
var collections = [
    'users',
    'players',
    'teams',
    'metadata',
    'leagues',
    'activity',
    'queue'
  ];
var db = require('mongojs').connect(databaseUrl, collections);
var ObjectID = require('mongodb').ObjectID;
var utils = require('util');
var async = require('async');
var extend = require('extend');
var log = require('log4js').getLogger('User');
module.exports = function (exporter) {
  return exporter.define('User', {
    _id: null,
    name: null,
    email: null,
    initial_setup: 'incomplete',
    pass: null,
    salt: null,
    leagues: [],
    teams: [],
    players: [],
    activity: [],
    access_token: null,
    access_token_expires: null,
    access_token_secret: null,
    guid: null,
    session_handle: null,
    session_handle_expired: null,
    request_token: null,
    request_verifier: null,
    request_token_secret: null,
    xoauth_request_auth_url: null,
    currentLogin: null,
  }, {
    findByName: function (name, next) {
      db.users.findOne({ name: name }, function (err, result) {
        if (err) {
          next(err);
        } else {
          next(null, result);
        }
      });
    },
    findByRequestToken: function (token, next) {
      db.users.findOne({ request_token: token }, function (err, result) {
        if (err || !result) {
          next(err || new Error('No result'));
        } else {
          next(null, result);
        }
      });
    },
    findById: function (id, next) {
      if (typeof id == 'string')
        id = new ObjectID(id);
      db.users.findOne({ _id: id }, function (err, result) {
        if (err || !result) {
          next(err || new Error('No result'));
        } else {
          next(null, result);
        }
      });
    },
    doesNameExist: function(name,next){
      this.findByName(name,function(err){
        if (!err)
          next(null,true);
        else if (err.toString() !== 'No Result')
          next(err);
        else 
          next(null,false);
      });
    },

  }, {
    save: function (next) {
      db.users.save(this, function (err) {
        next(err);
      });
    },
    remove: function (next) {
      db.users.remove(this, function (err) {
        next(err);
      });
    },
    init: function (next) {
      var self = this;
      db.users.findOne({ name: self.name }, function (err, result) {
        if (err) {
          next(new Error('Error accesing user database'));
        } else if (result) {
          next(new Error('User Account Already Exists'));
        } else {
          var hash_salt = slackr_utils.requestHashAsync(32);
          var hashed_pass_and_salt = crypto.createHash('md5').update(opt.upass + hash_salt).digest('hex');
          self.pass = hashed_pass_and_salt;
          self.salt = hash_salt;
          var oauth = models.oauth.create();
          oauth.getToken(function (err, tokenDetails) {
            if (err) {
              next(err);
            } else {
              extend(self, tokenDetails);
              self.save(function (err) {
                next(err);
              });
            }
          });
        }
      });
    },
    deactivate: function (next) {
    },
    getAccess: function (next) {
      var self = this;
      var oauth = models.oauth.load(self);
      oauth.getAccess(function (err, tokenDetails) {
        if (err) {
          next(err);
        } else {
          extend(self, tokenDetails);
          self.save(function (err) {
            next(err);
          });
        }
      });
    },
    refreshToken: function (next) {
      var self = this;
      var oauth = self.getOauthContext();
      oauth.refresh(function (err, tokenDetails) {
        if (err) {
          log.error(err);
          next(err);
        } else if (!tokenDetails){ // tokens are still good
          log.info("User's token is not expired");
          next(null);
        } else {
          log.info("User token refreshed");
          extend(self, tokenDetails);
          self.save(function (err) {
            next(err);
          });
        }
      });
    },
    getOauthContext: function () {
      var self = this;
      var copy = ["request_token","request_verifier","request_token_secret","xoauth_request_auth_url","access_token","access_token_secret","access_token_expires","session_handle","session_handle_expires","guid"];
      var oauth = models.oauth.create();
      copy.forEach(function(c){
        oauth.tokenDetails[c] = self[c];
      });
      return oauth;
    },
    makeSession: function (next) {
      this.currentLogin = slackr_utils.requestHashAsync();
      this.save(function (err) {
        next(err);
      });
    },
    destroySession: function (next) {
      this.currentLogin = null;
      this.save(function (err) {
        next(err);
      });
    },
    validateSession: function (session) {
      return this.currentLogin && this.currentLogin != session;
    },
    getLatestXml: function (next) {
      var self = this;
      var requestUrl = 'fantasy/v2/users;use_login=1/games/teams';
      self.getOauthContext(function (oauth) {
        oauth.get(requestUrl, function (err, response) {
          if (!err) {
            var keys = response.match(/[0-9]{3}\.l\.[0-9]{6}\.t\.[0-9]{1}/g);
            next(keys.filter(function (v) {
              !self.teamKeys || !self.teamKeys.indexOf(v);
            }) || null);
          } else {
            next(err);
          }
        });
      });
    },
    getAllGameData: function (next) {
      var self = this, return_object = {}, parallel = {
          players: function (cb) {
            if (!self.players.length) {
              self.getPlayers(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.players);
            }
          },
          teams: function (cb) {
            if (!self.teams.length) {
              self.getTeams(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.teams);
            }
          },
          leagues: function (cb) {
            if (!self.leagues.length) {
              self.getLeagues(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.leagues);
            }
          },
          activity: function (cb) {
            if (!self.activity.length) {
              self.getActivity(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.activity);
            }
          }
        };
      async.parallel(parallel, function (err, result) {
        next(err, result);
      });
    },
    getPlayers: function (next) {
      var self = this;
      models.player.findByOwner(self._id, function (err, result) {
        if (result) 
          self.players = result;
        next(err, result);
      });
    },
    getLeagues: function (next) {
      var self = this;
      models.league.findByOwner(self._id, function (err, result) {
        if (result) 
          self.leagues = result;
        next(err, result);
      });
    },
    getTeams: function (next) {
      var self = this;
      models.team.findByOwner(self._id, function (err, result) {
        if (result) 
          self.teams = result;
        next(err, result);
      });
    },
    getActivity: function (next) {
      var self = this;
      models.activity.findByOwner(self._id, function (err, result) {
        if (result) 
          self.activity = result;
        next(err, result);
      });
    },
    safeData: function(){
      return {
       _id: this._id,
        name: this.name,
        email: this.email,
        leagues: this.leagues,
        teams: this.teams,
        players: this.players,
        activity: this.activity,
        guid: this.guid,
        currentLogin: this.currentLogin
      }
    }
  });
};