var assert = require('assert');
var templates = require(__dirname+"/../src/xml/templates");

describe("Templates",function(){
	describe("movePlayer",function(){
		it("Should complile the movePlayer template",function(){
			var content = templates.movePlayer({
				week:"hi,",
				player_key: "Im",
				position: "a template"
			});
			assert.ok(content.match(/hi,/),"Templates does not contain test string!")
		})
	})
})