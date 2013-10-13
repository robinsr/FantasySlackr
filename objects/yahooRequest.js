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
	// hmmmmm... something here
	// next(err,response);
};

/*
 * Saves the request in the metadata db for later reference or processing
 *
 */

yahooRequest.prototype.logCall = function(next) {
	// hmmmmm... something here
	// next(err,response);
};