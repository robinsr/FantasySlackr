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
/**
 * Player Object
 * Get player from database: pass team_key and player_key only will trigger mongo query
 * else if opt.retrieved present (tell-tale sign this player is already in mongo) player will just extend
 */
module.exports = function (exporter) {
  return exporter.define('Player', {
    name: {
      first: null,
      last: null,
      full: null
    },
    settings: {
      never_drop: true,
      start_if_probable: true,
      start_if_questionable: false
    },
    team_key: null,
    player_key: null,
    bye_week: null
  }, {
    findByPlayerAndTeamKey: function (player_key, team_key, next) {
      db.players.findOne({
        player_key: self.player_key,
        team_key: self.team_key || self.provisional_team_key
      }, function (err, result) {
        if (err)
          next(err);
        else
          next(null, result);
      });
    },
    findById: function () {
      db.players.findOne({ _id: id }, function (err, result) {
        if (err)
          next(err);
        else
          next(null, result);
      });
    }
  }, {
    save: function (next) {
      db.players.save(this, function (err) {
        next(err);
      });
    },
    oauthContext: function (next) {
      async.waterfall([
        function (cb) {
          models.User.findById(this.owner, function (err, result) {
            cb(err, result);
          });
        },
        function (cb, user) {
          var u = models.User.load(user);
          u.getOauthContext(function (err, oauth) {
            next(err, oauth);
          });
        }
      ], function (err, result) {
        next(err, result);
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
    getLatestXml: function (next) {
      var self = this;
      var requestUrl = utils.format('fantasy/v2/player/%s/stats', self.player_key);
      self.get(requestUrl, function (err, newData) {
        if (!err) {
          console.log('Success: Fetched new data');
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
          console.log('Success: Fetched new data');
          newData.team.roster.players.player.forEach(function (p) {
            if (p.player_key == self.player_key) {
              self.retrieved = new Date().getTime();
              extend(true, self, p.selected_position);
              self.save(function (err) {
                next(err);
              });
            }
          });
        } else {
          next(err);
        }
      });
    },
    getOwnership: function (next) {
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
      async.waterfall([
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
          cb(null, templates.movePlayer.render({
            week: '13',
            player_key: self.player_key,
            position: desired_position
          }));
        },
        function (cb, requestXML) {
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