var http = require('http');
var utils = require('util');
var mashape = require('mashape-oauth').OAuth;
var appErr = require('../util/applicationErrors');
var extend = require('extend');
var dbMod = require('../util/dbModule');
var config = require('../config');
var log = require('log4js').getLogger('Oauth');
var NODE_ENV = process.env.NODE_ENV || 'development';
var endpoint = config[NODE_ENV].endpoint;
var requestUrl = config[NODE_ENV].requestUrl;
var accessUrl = config[NODE_ENV].accessUrl;

var databaseUrl = 'fantasyslackr';
var collections = [
    'metadata'
  ];
var db = require('mongojs').connect(databaseUrl, collections);

log.debug('Oauth using endpoint %s', endpoint);
/**
 * Oauth Object. gets Request Tokens, gets Access Token, makes signed requests using
 * GET/PUT/DELETE methods.
 * @param {[type]}   opt  Adds oauth properties from options object to oauth tokenDetails object.
 * Useful when all the oauth access properties are known and the Oauth is
 * intended to be used to make GET/PUT/DEL requests
 *
 * @param {Function} next Callback
 */
module.exports = function (exporter) {
  return exporter.define('oauth', {
    consumerKey: config.consumerKey,
    consumerSecret: config.consumerSecret,
    tokenDetails: {
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
  }, {}, {
    getToken: function (next) {
      var self = this;
      getPlaintext(self.consumerKey, self.consumerSecret, function (oa) {
        oa.getOAuthRequestToken(function (error, request_token, request_verifier, results) {
          if (error) {
            next(error);
          } else {
            self.tokenDetails.request_token = request_token;
            self.tokenDetails.request_verifier = request_verifier;
            self.tokenDetails.xoauth_request_auth_url = results.xoauth_request_auth_url;
            next(null);
          }
        });
      });
    },
    getAccess: function (next) {
      var self = this;
      // SETTIMEOUT, ESSENTIALLY TO WAIT FOR YAHOO TO CATCH UP
      setTimeout(function () {
        getHmac(self.consumerKey, self.consumerSecret, function (oa) {
          oa.getOAuthAccessToken({
            oauth_verifier: self.tokenDetails.request_verifier,
            oauth_token: self.tokenDetails.request_token,
            oauth_token_secret: self.tokenDetails.request_token_secret
          }, function (error, token, secret, result) {
            if (error) {
              next(new Error(error.data));
            } else {
              // extends this.tokenDetails with the result, parses expire dates into unix time
              (function (v) {
                v.access_token = token;
                v.access_token_secret = secret;
                v.access_token_expires = parseInt(new Date().getTime()) + parseInt(result.oauth_expires_in) * 1000;
                v.session_handle = result.oauth_session_handle;
                v.session_handle_expires = parseInt(new Date().getTime()) + parseInt(result.oauth_authorization_expires_in) * 1000;
                v.guid = result.xoauth_yahoo_guid;
              }(self.tokenDetails));
              next(null);
            }
          });
        });
      }, 500);
    },
    refreshToken: function (next) {
      log.info("Rereshing")
      var self = this;
      var now = new Date();
      var expires = new Date(self.tokenDetails.access_token_expires);
      log.info(now.toISOString(), expires.toISOString());
      if (typeof self.tokenDetails.access_token_expires == 'undefined' || now > self.tokenDetails.access_token_expires) {
        getPlaintext(self.consumerKey, self.consumerSecret, function (oa) {
          oa.getOAuthAccessToken({
            oauth_token: self.tokenDetails.access_token,
            oauth_token_secret: self.tokenDetails.access_token_secret,
            parameters: { oauth_session_handle: self.tokenDetails.session_handle }
          }, function (err, token, secret, result) {
            if (err) {
              log.error(err);
              next(err);
            } else {
              next(null, {
                access_token: token,
                access_token_secret: secret,
                access_token_expires: parseInt(new Date().getTime()) + parseInt(result.oauth_expires_in) * 1000,
                session_handle: result.oauth_session_handle,
                session_handle_expires: parseInt(new Date().getTime()) + parseInt(result.oauth_authorization_expires_in) * 1000,
                guid: result.xoauth_yahoo_guid
              });
            }
          });
        });
      } else {
        next(null);
      }
    },
    copyTokens: function (user) {
      var _this = this;
      var fields = Object.keys(_this.tokenDetails);
      fields.forEach(function (field) {
        _this.tokenDetails[field] = user[field];
      });
      return _this;
    },
    get: function (url, next) {
      url = endpoint + url;
      var self = this;
      self.refresh(function (err) {
        if (err) {
          next(err);
        } else {
          getHmac(self.consumerKey, self.consumerSecret, function (oa) {
            oa.get({
              url: url,
              oauth_token: self.tokenDetails.access_token,
              oauth_token_secret: self.tokenDetails.access_token_secret
            }, function (err, result) {
              if (err) {
                console.log(err);
                dbMod.apiRequestCounter('error');
                next(err);
              } else {
                dbMod.apiRequestCounter('success');
                if (process.env.NODE_ENV !== 'test')
                  db.metadata.save({data:result,url:url});
                next(null, result);
              }
            });
          });
        }
      });
    },
    put: function (url, xml, next) {
      url = endpoint + url;
      var self = this;
      self.refresh(function (err) {
        if (err) {
          next(err);
        } else {
          getHmac(self.consumerKey, self.consumerSecret, function (oa) {
            oa.put({
              url: url,
              body: xml,
              oauth_token: self.tokenDetails.access_token,
              oauth_token_secret: self.tokenDetails.access_token_secret,
            }, function (err, result) {
              if (!err && process.env.NODE_ENV !== 'test')
                db.metadata.save({data:result,url:url,put:xml});
              next(err, result);
            });
          });
        }
      });
    }
  });
};
/**
 * Returns plainText Mashape Oauth object
 * @param { String } k Consumer Key
 * @param { String } s Consumer Secret
 * @param  {Function} next Callback
 * @return {[type]}
 */
function getPlaintext(k, s, next) {
  // oauth object for getting access
  next(new mashape({
    realm: 'yahooapis.com',
    requestUrl: requestUrl,
    accessUrl: accessUrl,
    consumerKey: k,
    consumerSecret: s,
    signatureMethod: 'PLAINTEXT',
    nonceLength: 16,
    callback: 'http://demos.ethernetbucket.com/FantasySlackr/apicallback'
  }));
}
/**
 * Returns HMAC-SHA1 Mashape Oauth object
 * @param { String } k Consumer Key
 * @param { String } s Consumer Secret
 * @param  {Function} next Callback
 * @return {[type]}
 */
function getHmac(k, s, next) {
  // oauth object for getting access
  next(new mashape({
    realm: 'yahooapis.com',
    requestUrl: requestUrl,
    accessUrl: accessUrl,
    consumerKey: k,
    consumerSecret: s,
    signatureMethod: 'HMAC-SHA1',
    nonceLength: 16,
    version: '1.0'
  }));
}
