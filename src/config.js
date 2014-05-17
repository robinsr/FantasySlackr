module.exports = {
  consumerKey: 'dj0yJmk9TFhncFFkQWF1eHdsJmQ9WVdrOVVFTkZXV2hGTkRRbWNHbzlNVFF3TWpRNU1UQTJNZy0tJnM9Y29uc3VtZXJzZWNyZXQmeD04Mw--',
  consumerSecret: 'cd26f8daa5fe44126c2e6c6f13f528b68872407e',
  test: {
    endpoint: 'http://localhost:3001/',
    requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
    accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token'
  },
  development: {
    endpoint: 'http://fantasysports.yahooapis.com/',
    requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
    accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token'
  },
  prod: {
    endpoint: 'http://fantasysports.yahooapis.com/',
    requestUrl: 'https://api.login.yahoo.com/oauth/v2/get_request_token',
    accessUrl: 'https://api.login.yahoo.com/oauth/v2/get_token'
  }
};