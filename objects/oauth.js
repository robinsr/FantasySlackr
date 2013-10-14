var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    utils = require('util'),
    mashape = require('mashape-oauth').OAuth,
    db = require('../dbModule'),
	appErr = require('../util/applicationErrors');

	// separte server hosts oauth consumerKey and consumerSecret. only accessable locally
var consumerKey,consumerSecret;
(function(){
    var response = '';
    var postData = '';
    var postOptions = {
        host: '127.0.0.1',
        port: 8134,
        method: 'GET',
        headers: {
            'Content-Type' :'application/x-www-form-urlencoded'
        }
    };
    var keyReq = http.request(postOptions,function(res){
        res.on('data',function(chunk){
            response += chunk;
        });
        res.on('end',function(){
            var keys = JSON.parse(response);
            consumerKey = keys.consumerKey;
            consumerSecret = keys.consumerSecret;
        });
    });
    keyReq.write(postData);
    keyReq.end();
})();

var Oauth = function(opt){
	this.consumerKey = consumerKey;
	this.consumerSecret = consumerSecret;
	this.saveable = {
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

}

/**
 * Adds oauth properties from database to oauth object
 * @param  {Object} opt The database object with previously fetch properties
 * @return {[type]}
 */
Oauth.prototype.fromDb = function(opt) {
	this.saveable.request_token = opt.request_token;
	this.saveable.request_verifier = opt.request_verifier;
	this.saveable.request_token_secret = opt.request_token_secret;
	this.saveable.xoauth_request_auth_url = opt.xoauth_request_auth_url;
	this.saveable.access_token = opt.access_token;
	this.saveable.access_token_secret = opt.access_token_secret;
	this.saveable.access_token_expires = opt.access_token_expires;
	this.saveable.session_handle = opt.session_handle;
	this.saveable.session_handle_expires = opt.session_handle_expires;
	this.saveable.guid = opt.guid;
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
				next(error);
			} else {
				self.saveable.request_token = request_token;
				self.saveable.request_verifier = request_verifier;
				self.saveable.xoauth_request_auth_url = results.xoauth_request_auth_url;
				next(null);
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
				oauth_verifier: self.saveable.request_verifier,
				oauth_token: self.saveable.request_token,
				oauth_token_secret: self.saveable.request_token_secret
			}, function (error, token, secret, result) {
				if (error){
					next(new appErr.oauth('Could not get access token'));
				} else {
					self.saveable.access_token = token;
			        self.saveable.access_token_secret = secret;
			        self.saveable.access_token_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_expires_in) * 1000);
			        self.saveable.session_handle = result.oauth_session_handle;
			        self.saveable.session_handle_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_authorization_expires_in) * 1000);
			        self.saveable.guid = result.xoauth_yahoo_guid;
					next(null);
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
	getPlaintext(self.consumerKey, self.consumerSecret, function(oa){
		oa.getOAuthAccessToken({
			oauth_token: self.saveable.access_token,
			oauth_token_secret: self.saveable.access_token_secret,
			parameters : {
				oauth_session_handle: self.saveable.session_handle
			}
		}, function (error, token, secret, result) {
			if (error){
				next(new appErr.oauth('Could not get refresh token'));
			} else {
				self.saveable.access_token = token;
				self.saveable.access_token_secret = secret;
				self.saveable.access_token_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_expires_in) * 1000);
				self.saveable.session_handle = result.oauth_session_handle;
				self.saveable.session_handle_expires = parseInt(new Date().getTime()) + (parseInt(result.oauth_authorization_expires_in) * 1000);
				self.saveable.guid = result.xoauth_yahoo_guid;
				next(null);
			}
		});
	})
};

Oauth.prototype.getSaveableProperties = function(next) {
	var self = this;
	next(self.saveable);
};

/**
 * Makes an oauth GET request. requires YahooRequest object
 * @param  {Object} yahooRequest The yahooRequest object associated with this oauth request
 * @param  {Function} next
 * @return {[type]}
 */
// Oauth.prototype.get = function(yahooRequest, next) {
// 	checkExpirationDate()

// 	next(err);
// };

/**
 * Makes an oauth PUT request. requires YahooRequest object
 * @param  {Object} yahooRequest The yahooRequest object associated with this oauth request
 * @param  {Function} next
 * @return {[type]}
 */
// Oauth.prototype.put = function(yahooRequest, next) {
// 	checkExpirationDate()

// 	next(err);
// };


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

/*
 * Given a user object, determine if the access token needs to be refreshed. If so, then refren token
 * @param user_object: object. REQUIRED
 * 
 */

// function checkExpirationDate (user_object,cb){
//     var token = user_object.access_token,
//     token_ex = user_object.access_token_expires,
//     secret = user_object.access_token_secret,
//     handle = user_object.session_handle,
//     handle_ex = user_object.session_handle_expires,
//     now = new Date().getTime();

//     if ((typeof token_ex == 'undefined') || (now > token_ex)){
//         console.log('getting new access token. typeof is '+typeof token_ex+' , now is '+now+' , token ex is '+token_ex);
//         oauthModule.refreshToken(token,secret,handle,function(err,newtoken,newsecret,result){
//             if (err) {
//                 cb(1);
//             } else {
//                 storeAccessResult(user_object.name,newtoken,newsecret,result);
//                 cb(null,newtoken,newsecret,result);
//             }
//         });
//     } else {
//         cb(null,token,secret);
//     }
// }

module.exports.Oauth = Oauth;