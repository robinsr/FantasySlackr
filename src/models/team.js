var async = require('async');
var databaseUrl = 'fantasyslackr';
var collections = [
    'teams',
    'playerList',
    'players'
  ];
var db = require('mongojs').connect(databaseUrl, collections);
var ObjectID = require('mongodb').ObjectID;
var utils = require('util');
var appErr = require('../util/applicationErrors');
var parser = require('libxml-to-js');
var extend = require('extend');
var models = require(__dirname + '/../models');
var log = require('log4js').getLogger('Team');
var Player = models.Player, User = models.User, League = models.League;
/**
 * Team constructor
 * @param {object}   opt  opt.team_key
 * @param {Function} next [description]
 */
module.exports = function (exporter) {
  return exporter.define('Team', {
    setting: {
      probable_player: 'start',
      questionable_player: 'bench',
      out_player: 'replace',
      lack_of_players: 'replace_injured',
      ask_qb: false,
      ask_rb: false,
      ask_wr: false,
      ask_te: false,
      ask_def: false,
      ask_k: false,
      emails: true,
      injury_reports: true
    },
    team_key : null,
    owner : null,
    team_id : null,
    name : null,
    is_owned_by_current_login : null,
    url : null,
    team_logos : {
        team_logo : {
            size : null,
            url : null
        }
    },
    waiver_priority : null,
    number_of_moves : null,
    number_of_trades : null,
    roster_adds : {
        coverage_type : null,
        coverage_value : null,
        value : null
    },
    clinched_playoffs : null,
    managers : {
        manager : {
            manager_id : null,
            nickname : null,
            guid : null,
            is_commissioner : null,
            is_current_login : null
        }
    },
    league_key : null,
    _id : null,
    roster: null
  }, {
    findByKey: function (teamkey, next) {
      db.teams.findOne({ team_key: teamkey }, function (err, result) {
        if (err) {
          next(err);
        } else if (!result) {
          next(new Error('No team found'));
        } else {
          next(result);
        }
      });
    },
    findByOwner: function(owner, next){
      if (typeof owner == 'string')
        owner = new ObjectID(owner);
      db.teams.find({ owner: owner }, function (err, result) {
        console.log(result)
        next(err,result);
      });
    }
  }, {
    save: function (next) {
      db.teams.save(this, function (err) {
        if (err) {
          next(new Error('Error saving team in database'));
        } else {
          next(null);
        }
      });
    },
    oauthContext: function (next) {
      var self = this;
      User.findById(this.owner, function (err, result) {
        if (err) {
          next(err);
        } else {
          User.load(result).getOauthContext(function (oauth) {
            next(null, oauth);
          });
        }
      });
    },
    get: function (url, next) {
      var self = this;
      function getOauthContext(cb) {
        self.oauthContext(function (err, oauth) {
          cb(err, oauth);
        });
      }
      function getData(oauth, cb) {
        oauth.get(requestUrl, function (err, response) {
          cb(err, response);
        });
      }
      function parseData(data, cb) {
        parser(response, function (err, jsObject) {
          cb(err, jsObject);
        });
      }
      async.waterfall([
        getOauthContext,
        getData,
        parseData
      ], function (err, result) {
        next(err, result);
      });
    },
    getPlayersFromYahoo: function (opt, next) {
      var self = this;
      var playerArray = [];
      var requestUrl = utils.format('fantasy/v2/league/%s/players', self.league_key);
      if (opt.position) {
        requestUrl += utils.format(';position=%s', opt.position);
      }
      if (opt.sort) {
        requestUrl += utils.format(';sort=%s', opt.sort);
      }
      if (opt.stat) {
        requestUrl += utils.format(';status=%s', opt.stat);
      }
      function getData(oauth, cb) {
        self.get(requestUrl, function (err, response) {
          cb(err, response);
        });
      }
      function checkData(jsObject, cb) {
        if (jsObject && jsObject.league && jsObject.league.players && jsObject.league.players.player) {
          cb(err, jsObject);
        } else {
          var e = new Error('Returned object from yahoo does not have players');
          log.error(e);
          cb(e);
        }
      }
      function buildArray(newData, cb) {
        if (newData.league.players.player || newData.league.players.player.length > 0) {
          async.each(newData.league.players.player, function (p, nextP) {
            p.team_key = self.team_key;
            p.retrieved = new Date().getTime();
            playerArray.push(Player.load(p));
            nextP(null);
          }, function (err) {
            cb(null, playerArray);
          });
        } else {
          cb(null, playerArray);
        }
      }
      async.waterfall([
        getData,
        checkData,
        buildArray
      ], function (err, result) {
        next(err, result);
      });
    },
    getLatestXml: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/team/%s/roster/players', self.team_key);
      async.auto({
        getLeagueKeys: function (cb) {
          self.get(requestUrl, function (err, jsObj) {
            cb(err, jsObj);
          });
        },
        getLeague: [
          'getLeagueKeys',
          function (cb, jsObj) {
            self.getLeague(function (args) {
              if (!args.err) {
                cb(null);
              } else {
                cb(args.err);
              }
            });
          }
        ],
        extractRoster: [
          'getLeagueKeys',
          function (cb, jsObj) {
            self.extractRoster(function (args) {
              if (!args.err) {
                cb(null);
              } else {
                cb(args.err);
              }
            });
          }
        ]
      }, function (err) {
        next(err);
      });  // log.info('Success: Fetched new data');
           // extend(self,newData.team);
           // self.league_key = self.team_key.match(/[0-9]{3}\.l\.[0-9]{6}/)[0];
           // async.parallel([
           // 	function(cb){
           // 	},
           // 	function(cb){
           // 	}],function(err){
           // 		if (err) arguments.err = err;
           // 		next.call(self,arguments);
           // 	})				
    },
    getLeague: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/league/%s/settings', self.league_key);
      self.get(requestUrl, function (err, leagueData) {
        if (!err) {
          var l = League.load(leagueData.league);
          log.info(l);
          l.save(function (args) {
            next(null);
          });
        } else {
          next(err);
        }
      });
    },
    loadRoster: function (next) {
      var self = this;
      db.players.find({ team_key: self.team_key }, function (err, result) {
        self.roster = result;
        next(err, result);
      });
    },
    extractRoster: function (next) {
      var self = this;
      Object.deepProperty.call(self, 'this.roster.players.player', {
        fail: function (args) {
          next(new Error('This team has no roster'));
        },
        success: function (args) {
          async.eachSeries(self.roster.players.player, function (p, nextP) {
            p.owner = self.owner;
            p.team_key = self.team_key;
            p.retrieved = new Date().getTime();
            Player.load(p).save(function (err) {
              nextP(err);
            });
          }, function (err) {
            delete self.roster;
            self.save(function (err) {
              next(err);
            });
          });
        }
      });
    }
  });
};
