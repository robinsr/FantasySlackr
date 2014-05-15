var databaseUrl = "fantasyslackr",
	collections = ["players","teams","leagues"],
	db = require("mongojs").connect(databaseUrl, collections),
	objectId = require('mongodb').ObjectID,
	utils = require('util'),
	async = require('async'),
	currentWeek = require('../util/currentWeek').week(),
	extend = require('extend');

/**
 * Ranking class contains methods for comparing players
 * @param {[type]}   opt  [description]
 * @param {Function} next [description]
 */
function Ranking(opt,next){
	var self = this;
	if (opt.player_key){
		extend(self,opt)
	}
	next.call(self,arguments)
}


/**
 * valueToTeam retuns an object that scores the player in the context of their team. It takes into account:
 * Player's bye week, player's injury status, ammount of players in their position compared to the required amount for that league,
 * other players in their position bye week.
 * @param  {Function} next [description]
 * @return {[type]}        [description]
 */
Ranking.prototype.valueToTeam = function(next) {
	var self = this;
	var runningTotal = 0;
	var statusFactor = {
		'OK':4,
		'P':3,
		'Q':2,
		'IR':1,
		'O':-25
	};
	var otherPlayers;
	var stock;
	var teamStockOverRequired = {
		'minus3':3,
		'minus2':2,
		'minus1':1,
		'plus0':0,
		'plus1':-1,
		'plus2':-2,
		'plus3':-3
	}
	var byeWeek = {
		'past':1,
		'current':0,
		'future':-1
	}
	var othersByeWeeks = {
		'past':-1,
		'current':0,
		'future':1
	}
	async.series([

		function(nextSeries){
			if (!self.status){
				runningTotal += statusFactor['OK'];
				self.vT.statusfactor = statusFactor['OK'];
			} else {
				runningTotal += statusFactor[self.status]
				self.vT.statusfactor = statusFactor[self.status]
			}
			nextSeries(null)
		},

		function(nextSeries){
			if (parseInt(self.bye_weeks.week) > parseInt(currentWeek)){
				runningTotal += byeWeek['future'];
				self.vT.byeWeek = byeWeek['future'];
			} else if (parseInt(self.bye_weeks.week) == parseInt(currentWeek)){
				runningTotal += byeWeek['current'];
				self.vT.byeWeek = byeWeek['current'];
			} else {
				runningTotal += byeWeek['past'];
				self.vT.byeWeek = byeWeek['past'];
			}
			nextSeries(null)
		},

		function(nextSeries){
			self.checkoutTeam(false,function(err,others){
				otherPlayers = others.length;
				self.vT.others = others.length;
				self.vT.othersByeWeeks = 0;
				// async.eachSeries(others,function(other,nextOther){
				// 	if (parseInt(other.bye_weeks.week) > parseInt(currentWeek)){
				// 		console.log(self.name.full+" is getting "+othersByeWeeks['future']+" because "+other.name.full+"'s bye week is yet to come")
				// 		runningTotal += othersByeWeeks['future'];
				// 		self.vT.othersByeWeeks += othersByeWeeks['future']
				// 	} else if (parseInt(other.bye_weeks.week) == parseInt(currentWeek)){
				// 		console.log(self.name.full+" is getting "+othersByeWeeks['current']+" because "+other.name.full+"'s bye week is this week")
				// 		runningTotal += othersByeWeeks['current'];
				// 		self.vT.othersByeWeeks += othersByeWeeks['current']
				// 	} else {
				// 		console.log(self.name.full+" is getting "+othersByeWeeks['past']+" because "+other.name.full+"'s bye week has already happened")
				// 		runningTotal += othersByeWeeks['past'];
				// 		self.vT.othersByeWeeks += othersByeWeeks['past']
				// 	}
				// 	nextOther(null)
				// })
				nextSeries(null)
			})
		},

		function(nextSeries){
			// if (self.eligible_positions.position != 'K' && self.eligible_positions.position != 'DEF'){
				db.teams.findOne({team_key:self.team_key},function(err,team){
					db.leagues.findOne({league_key: team.league_key},function(err,league){
						async.eachSeries(league.settings.roster_positions.roster_position,function(pos,cb){
							if (pos.position == self.eligible_positions.position){
								stock = pos.count;
								self.vT.stock = parseInt(pos.count);
							} 
							cb(null)
						},function(){
							var l;
							var overStock = parseInt(otherPlayers+1) - parseInt(stock);
							runningTotal += teamStockOverRequired[overStock >= 0 ? l = "plus"+Math.abs(overStock) : l = "minus"+Math.abs(overStock)]
							self.vT.teamStockOverRequired = teamStockOverRequired[overStock >= 0 ? l = "plus"+Math.abs(overStock) : l = "minus"+Math.abs(overStock)]
							nextSeries(null)
						})
					})
				})
			// } else {
			// 	runningTotal += teamStockOverRequired['plus0'];
			// 	self.vT.teamStockOverRequired = teamStockOverRequired['plus0'];
			// 	nextSeries(null)
			// }
		}
		],

		function(){
			self.vT.total = runningTotal;
			next.call(self.vT,arguments);
		})
};

module.exports.Ranking = Ranking;