var models = require(__dirname+"/../src/models");


describe("Player",function(){
	describe("create",function(){
		it("Should return a new player object",function(done){
			models.player.create()
		})
	})
})