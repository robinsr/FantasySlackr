var Oauth = require('./oauth').Oauth

var YahooRequest = function(obj){
	var self = this;

	self.xml = obj.xml;
	self.url = obj.url;
	self.user = obj.user;
}

/*
 * Makes the HTTP request to yahoo servers
 *
 */

YahooRequest.prototype.send = function(next) {
	var self = this;
	console.log('yahoo sending stuff:')
	console.log(self);
	var oauthRequest = new Oauth({
		// options
	});
	oauthRequest.send(function(err){
		next(err);
	})
};

/*
 * Saves the request in the metadata db for later reference or processing
 *
 */

YahooRequest.prototype.logCall = function(next) {
	// hmmmmm... something here
	// next(err,response);
};

module.exports.YahooRequest = YahooRequest;