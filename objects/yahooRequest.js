var oauth = require('./oauth')

var yahooRequest = function(obj){
	var self = this;

	self.xml = obj.xml;
	self.url = obj.url;
	self.user = obj.user;
}

/*
 * Makes the HTTP request to yahoo servers
 *
 */

yahooRequest.prototype.send = function(next) {
	var oauthRequest = oauth.Oauth({
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

yahooRequest.prototype.logCall = function(next) {
	// hmmmmm... something here
	// next(err,response);
};