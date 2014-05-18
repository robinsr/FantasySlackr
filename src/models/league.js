var extend = require('extend');
var databaseUrl = 'fantasyslackr';
var collections = ['leagues'];
var db = require('mongojs').connect(databaseUrl, collections);
var ObjectID = require('mongodb').ObjectID;
module.exports = function (exporter) {
  return exporter.define('League', {
    league_key : null,
    league_id : null,
    name : null,
    url : null,
    password : null,
    draft_status : null,
    num_teams : null,
    edit_key : null,
    weekly_deadline : null,
    league_update_timestamp : null,
    scoring_type : null,
    league_type : null,
    is_pro_league : null,
    current_week : null,
    start_week : null,
    start_date : null,
    end_week : null,
    end_date : null,
    settings : {
        draft_type : null,
        is_auction_draft : null,
        scoring_type : null,
        uses_playoff : null,
        has_playoff_consolation_games : null,
        playoff_start_week : null,
        uses_playoff_reseeding : null,
        uses_lock_eliminated_teams : null,
        num_playoff_teams : null,
        num_playoff_consolation_teams : null,
        waiver_rule : null,
        uses_faab : null,
        draft_time : null,
        max_teams : null,
        waiver_time : null,
        trade_end_date : null,
        trade_ratify_type : null,
        trade_reject_time : null,
        player_pool : null,
        roster_positions : {
            roster_position : [] // model roster_position
        },
        stat_categories : {
            stats : {
                stat : [] // model stat_category
            }
        },
        stat_modifiers : {
            stats : {
                stat : [] // model stat_modifier
            }
        }
    },
    _id : null,
    owners: [] // model users
	}, {
		findByOwner: function(owner, next){
    		if (typeof owner == 'string')
    			owner = new ObjectID(owner);
    		db.leagues.find({ owners: { $in: [owner] } }, function (err, result){
    			next(err,result);
    		});
    	}
	}, {
    save: function (next) {
      var self = this;
      db.leagues.save(self, function (err) {
        if (err)
          next(err);
        else
          next(null);
      });
    }
  });
};