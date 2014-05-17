var crypto = require('crypto');
var slackr_utils = require('../slackr_utils');
var appErr = require('../util/applicationErrors');
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
var models = require(__dirname + '/../models');
var log = require('log4js').getLogger('User');
var publishChannel = 'new-setup-request';
module.exports = function (exporter) {
  return exporter.define('User', {
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
    current_login: null,
    request_token: null,
    request_verifier: null,
    request_token_secret: null,
    xoauth_request_auth_url: null
  }, {
    findByName: function (name, next) {
      db.users.findOne({ name: name }, function (err, result) {
        if (err || !result) {
          next(err || new Error('Could not find user ' + name + ' in database'));
        } else {
          next(null, result);
        }
      });
    },
    findByRequestToken: function (token, next) {
      db.users.findOne({ request_token: token }, function (err, result) {
        if (err || !result) {
          next(err || new Error('Could not find user in database'));
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
          next(err || new Error('Could not find user in database'));
        } else {
          next(null, result);
        }
      });
    }
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
      var oauth = models.oauth.load(self).copyTokens(self);
      oauth.refresh(function (err, tokenDetails) {
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
    getOauthContext: function (next) {
      var self = this;
      next(models.oauth.load(self));
    },
    makeSession: function () {
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
            if (!self.players) {
              self.getPlayers(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.players);
            }
          },
          teams: function (cb) {
            if (!self.teams) {
              self.getTeams(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.teams);
            }
          },
          leagues: function (cb) {
            if (!self.leagues) {
              self.getLeagues(function (err, result) {
                cb(err, result);
              });
            } else {
              cb(null, self.leagues);
            }
          },
          activity: function (cb) {
            if (!self.activity) {
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
      var args = { owner: self._id };
      if (team_key) {
        args.team_key = team_key;
      }
      console.log(args);
      db.players.find(args, function (err, result) {
        if (!err) {
          self.players = result;
          next(null, self.players);
        } else if (err) {
          next(err);
        }
      });
    },
    getLeagues: function (next) {
      var self = this;
      self.getTeams(function (args) {
        if (!args.err && this.teams && this.teams.length > 0) {
          async.eachSeries(this.teams, function (team, cb) {
            db.leagues.find({ league_key: team.league_key }, function (err, result) {
              if (err) {
                cb(err);
              } else {
                self.leagues.push(result[0]);
                cb(null);
              }
            }, function (err) {
              next(err, self.leagues);
            });
          });
        } else {
          next(err);
        }
      });
    },
    getTeams: function (next) {
      var self = this;
      db.teams.find({ owner: self._id }, function (err, result) {
        if (err) {
          next(err);
        } else {
          self.teams = result;
          next(null, self.teams);
        }
      });
    },
    getActivity: function (next) {
      var self = this;
      db.activity.find({ name: self.name }).sort({ date: -1 }).limit(5, function (err, result) {
        if (err) {
          next(err);
        } else {
          self.activity = result;
          next(null, self.activity);
        }
      });
    }
  });
};