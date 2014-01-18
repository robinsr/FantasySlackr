require('../slackr_utils');



var test = {
	player: {
		result: {
			players: ["stuff"]
		}
	}
}

test.deepProperty("test.player.result.players",{
	success: function(args){
		console.log('it worked')
	},
	fail: function(args){
		console.log('it failed')
	}
})