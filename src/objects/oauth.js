var http = require('http'),
    utils = require('util'),
    mashape = require('mashape-oauth').OAuth,
	appErr = require('../util/applicationErrors'),
	extend = require('extend'),
	dbMod = require('../util/dbModule'),
    config = require('../config');

/**
 * Oauth Object. gets Request Tokens, gets Access Token, makes signed requests using
 * GET/PUT/DELETE methods. 
 * @param {[type]}   opt  Adds oauth properties from options object to oauth tokenDetails object.
 * Useful when all the oauth access properties are known and the Oauth is
 * intended to be used to make GET/PUT/DEL requests
 * 
 * @param {Function} next Callback
 */
function Oauth(opt,next){
	var self = this;
	self.consumerKey = config.consumerKey;
	self.consumerSecret = config.consumerSecret;
	self.tokenDetails = {
		request_token: null,
		request_verifier: null,
		request_token_secret: null,
		xoauth_request_auth_url: null,
		access_token: null,
		access_token_secret: null,
		access_token_expires: null,
		session_handle: null,
		session_handle_expires: null,
		guid: null
	}

	if (opt){
		extend(self.tokenDetails, opt);
		next.call(self,arguments);
	} else {
		next.call(self,arguments);
	}
}

/**
 * Gets a new request token
 * @param  {function} next Callback
 * @return {[type]}
 */
Oauth.prototype.getToken = function(next) {
	var self = this;
	getPlaintext(self.consumerKey,self.consumerSecret,function(oa){
		oa.getOAuthRequestToken(function (error, request_token, request_verifier, results) {
			if (error){
				arguments.err = new appErr.oauth("Error getting request token")
				next.call(self,arguments);
			} else {
				self.tokenDetails.request_token = request_token;
				self.tokenDetails.request_verifier = request_verifier;
				self.tokenDetails.xoauth_request_auth_url = results.xoauth_request_auth_url;
				next.call(self,arguments);
			}
		});
	})
};

/**
 * Exchanges request token for access token
 * @param  {Function} next
 * @return {[type]}
 */
Oauth.prototype.getAccess = function(next) {
	var self = this;
	// SETTIMEOUT, ESSENTIALLY TO WAIT FOR YAHOO TO CATCH UP
	setTimeout(function(){
		getHmac(self.consumerKey, self.consumerSecret, function(oa){
			oa.getOAuthAccessToken({
				oauth_verifier: self.tokenDetails.request_verifier,
				oauth_token: self.tokenDetails.request_token,
				oauth_token_secret: self.tokenDetails.request_token_secret
			}, function (error, token, secret, result) {
				if (error){
					arguments.err = new appErr.oauth("Error getting access token")
					next.call(self,arguments);
				} else {
					(function(v){
						v.access_token = token;
						v.access_token_secret = secret;
						v.access_token_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_expires_in) * 1000);
						v.session_handle = result.oauth_session_handle;
						v.session_handle_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_authorization_expires_in) * 1000);
						v.guid = result.xoauth_yahoo_guid;
					})(self.tokenDetails)
					next.call(self,arguments);
				}
			});
		})
	},500);
};

/**
 * Refreshes access token
 * @param  {Function} next
 * @return {[type]}
 */			
Oauth.prototype.refresh = function(next) {
	var self = this;
	//console.log(self);
	now = new Date().getTime();
    if ((typeof self.tokenDetails.access_token_expires == 'undefined') || (now > self.tokenDetails.access_token_expires)){
    	getPlaintext(self.consumerKey, self.consumerSecret, function(oa){
			oa.getOAuthAccessToken({
				oauth_token: self.tokenDetails.access_token,
				oauth_token_secret: self.tokenDetails.access_token_secret,
				parameters : {
					oauth_session_handle: self.tokenDetails.session_handle
				}
			}, function (error, token, secret, result) {
				if (error){
					arguments.err = new appErr.oauth("Could not get refresh token")
					next.call(self,arguments);
				} else {
					(function(v){
						v.access_token = token;
						v.access_token_secret = secret;
						v.access_token_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_expires_in) * 1000);
						v.session_handle = result.oauth_session_handle;
						v.session_handle_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_authorization_expires_in) * 1000);
						v.guid = result.xoauth_yahoo_guid;
					})(self.tokenDetails)
					next.call(self,arguments);
				}
			});
		})
    } else {
    	next.call(self,arguments);
    }
};


/**
 * Makes an oauth GET request. requires YahooRequest object
 * @param  {Function} next
 * @return {[type]}
 */
Oauth.prototype.get = function(url,next) {
	var self = this;
	console.log(url)
	self.refresh(function(args){
		if (args.err){
			arguments.err = args.err;
			next(args.err)
		} else {
			getHmac(self.consumerKey,self.consumerSecret,function(oa){
				oa.get({
					url: url,
					oauth_token: self.tokenDetails.access_token,
					oauth_token_secret: self.tokenDetails.access_token_secret
				},function(err,result){
					if (err){
						console.log(err);
						dbMod.apiRequestCounter('error');
						next(err)
					} else {
						console.log(result)
						dbMod.apiRequestCounter('success');
						next(null,result)
					}
				})
			})	
		}
	})
};

/**
 * Makes an oauth PUT request. requires YahooRequest object
 * @param  {Object} yahooRequest The yahooRequest object associated with this oauth request
 * @param  {Function} next
 * @return {[type]}
 */
Oauth.prototype.put = function(url,xml, next) {
	var self = this;
	self.refresh(function(err){
		if (err){
			next(err)
		} else {
			console.log(self)
			getHmac(self.consumerKey,self.consumerSecret,function(oa){
				oa.put({
					url: url,
					body: xml,
					oauth_token: self.tokenDetails.access_token,
					oauth_token_secret: self.tokenDetails.access_token_secret
				},function(err,result){
					console.log(err);
					console.log(result)
				})
			})	
		}
	})
};


/**
 * Returns plainText Mashape Oauth object
 * @param { String } k Consumer Key
 * @param { String } s Consumer Secret
 * @param  {Function} next Callback
 * @return {[type]}
 */
function getPlaintext(k,s,next){
  	// oauth object for getting access
    next(new mashape({
	    realm: 'apis.yahoo.com',
	    requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
	    accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token',
	    consumerKey: k,
	    consumerSecret: s,
	    signatureMethod: 'PLAINTEXT',
	    nonceLength: 16,
	    callback: "http://demos.ethernetbucket.com/FantasySlackr/apicallback"
	}));
}
/**
 * Returns HMAC-SHA1 Mashape Oauth object
 * @param { String } k Consumer Key
 * @param { String } s Consumer Secret
 * @param  {Function} next Callback
 * @return {[type]}
 */
function getHmac(k,s,next){
  	// oauth object for getting access
    next(new mashape({
	    realm: 'apis.yahoo.com',
	    requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
	    accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token',
	    consumerKey: k,
	    consumerSecret: s,
	    signatureMethod: 'HMAC-SHA1',
	    nonceLength: 16,
	    version: "1.0"
	}));
}



module.exports.Oauth = Oauth;