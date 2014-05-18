var databaseUrl = 'fantasyslackr';
var collections = [
    'players',
    'teams',
    'leagues'
  ];
var db = require('mongojs').connect(databaseUrl, collections);
var objectId = require('mongodb').ObjectID;
var utils = require('util');
var async = require('async');
var appErr = require('../util/applicationErrors');
var currentWeek = require('../util/currentWeek').week();
var jsonxml = require('jsontoxml');
var parser = require('libxml-to-js');
var extend = require('extend');
var models = require(__dirname + '/../models');
var templates = require(__dirname + '/../xml/templates');
var log = require('log4js').getLogger('Player');
/**
 * Player Object
 * Get player from database: pass team_key and player_key only will trigger mongo query
 * else if opt.retrieved present (tell-tale sign this player is already in mongo) player will just extend
 */
module.exports = function (exporter) {
  return exporter.define('Player', {
    settings : {
      never_drop : null,
      start_if_probable : null,
      start_if_questionable : null
    },
    player_key : null,
    player_id : null,
    name : {
      full : null,
      first : null,
      last : null,
      ascii_first : null,
      ascii_last : null
    },
    status : null,
    editorial_player_key : null,
    editorial_team_key : null,
    editorial_team_full_name : null,
    editorial_team_abbr : null,
    bye_weeks : {
      week : null
    },
    uniform_number : null,
    display_position : null,
    headshot : {
      url : null,
      size : null
    },
    image_url : null,
    is_undroppable : null,
    position_type : null,
    eligible_positions : {
      position : null
    },
    has_player_notes : null,
    has_recent_player_notes : null,
    selected_position : {
      coverage_type : null,
      week : null,
      position : null
    },
    owner : null,
    team_key : null,
    retrieved : null,
    _id : null
  }, {
    findByPlayerAndTeamKey: function (player_key, team_key, next) {
      db.players.findOne({
        player_key: player_key,
        team_key: team_key
      }, function (err, result) {
        next(err,result);
      });
    },
    findById: function (id, next) {
      if (typeof id == 'string')
        id = new ObjectID(id);
      db.players.findOne({ _id: id }, function (err, result) {
        next(err,result);
      });
    },
    findByOwner: function(owner, next){
      if (typeof owner == 'string')
        owner = new ObjectID(owner);
      db.players.find({ owner: owner }, function (err, result){
        next(err,result);
      });
    }
  }, {
    save: function (next) {
      db.players.save(this, function (err) {
        next(err);
      });
    },
    remove: function (next) {
      db.players.remove({_id: this._id}, function (err) {
        next(err);
      });
    },
    oauthContext: function (next) {
      var self = this;
      async.waterfall([
        function (cb) {
          models.user.findById(self.owner, function (err, result) {
            cb(err, result);
          });
        },
        function (user, cb) {
          user = models.user.load(user);
          user.refreshToken(function (err) {
            cb(err,user);
          });
        },
        function (user, cb){
          var oauth = user.getOauthContext();
          cb(null,oauth);
        }
      ], function (err, result) {
        next(err, result);
      });
    },
    get: function (requestUrl, next) {
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
      function parseData(response, cb) {
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
    put: function (url, data, next) {
      var self = this;
      function getOauthContext(cb) {
        self.oauthContext(function (err, oauth) {
          cb(err, oauth);
        });
      }
      function putData(oauth, cb) {
        oauth.put(requestUrl, data, function (err, response) {
          cb(err, response);
        });
      }
      async.waterfall([
        getOauthContext,
        putData
      ], function (err, result) {
        next(err, result);
      });
    },
    getLatestStats: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/player/%s/stats', self.player_key);
      self.get(requestUrl, function (err, newData) {
        if (!err) {
          log.info('Success: Fetched new data');
          newData.player.retrieved = new Date().getTime();
          extend(self, newData.player);
          self.save(function (err) {
            next(err);
          });
        } else {
          next(err);
        }
      });
    },
    getLatestPosition: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/team/%s/roster/players', self.team_key);
      self.get(requestUrl, function (err, newData) {
        if (!err) {
          var relevantPlayer = newData.team.roster.players.player.filter(function(p){
            return p.player_key == self.player_key;
          });
          if (relevantPlayer[0]){
            self.retrieved = new Date().getTime();
            self.selected_position = relevantPlayer.selected_position;
            self.save(function (err) {
              next(err);
            });
          } else {
            next(new Error("Cannot get current position of player! Is this player on this team?"));
          }          
        } else {
          next(err);
        }
      });
    },
    getOwnershipPercentage: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/player/%s/percent_owned', self.player_key);
      self.get(requestUrl, function (err, response) {
        if (!err) {
          parser(response, function (err, newData) {
            if (!err) {
              console.log('Success: Fetched new data');
              console.log(newData);
            } else {
              next(null);
            }
          });
        } else {
          next(err);
        }
      });
    },
    isBye: function () {
      if (this.bye_week == currentWeek) {
        return true;
      } else {
        return false;
      }
    },
    getFreeAgentReplacement: function (replacementPlayerKey) {
    },
    getWaiverReplacement: function (replacementPlayerKey) {
    },
    moveToStart: function (next) {
      self._movePlayer(self.position, function (err) {
        next(err);
      });
    },
    moveToBench: function (next) {
      self._movePlayer('BN', function (err) {
        next(err);
      });
    },
    _movePlayer: function (desired_position, next) {
      log.info('Moving %s to %s', this.name.full, position);
      var self = this;
      var requestURL = 'fantasy/v2/team/' + self.team_key + '/roster';
      async.series([
        function (cb) {
          self.getLatestPosition(function (err) {
            next(err);
          });
        },
        function (cb) {
          if (self.selected_position.position == desired_position) {
            cb(new Error('Cannot move player on bench to bench'));
          } else {
            cb(null);
          }
        },
        function (cb) {
          // dont render XML till last minute
          var requestXML = templates.movePlayer.render({
            week: '13',
            player_key: self.player_key,
            position: desired_position
          });
          self.put(requestURL, requestXML, function (err, response) {
            log.error(err);
            log.debug(response);
            cb(null);
          });
        }
      ], function (err) {
        next(err);
      });
    },
    checkoutTeam: function (benchOnly, next) {
      var self = this;
      // QUERY
      var args = {
          'name.full': { $ne: self.name.full },
          'team_key': self.team_key,
          'eligible_positions.position': self.eligible_positions.position,
          'status': {
            $ne: [
              'O',
              'IR'
            ]
          }
        };
      if (benchOnly) {
        args['selected_position.position'] = 'BN';
      }
      db.players.find(args, function (err, result) {
        if (!err && result) {
          next(null, result);
        } else {
          next(err);
        }
      });
    }
  });
};