var user = require(__dirname + '/routes/user');
var auth = require(__dirname + '/routes/auth');


module.exports = function(app, passport) {

  //app.get('/', routes.index);
  //app.get('/users', user.list);
  //app.get('.apicallback', oauth.callback);
  /*
   * ======================
   * ====== USER ==========
   */
  // create
  app.post('/user', user.create);
  // login
  app.post('/user/login', user.login);
  // update
  app.put('/user', auth.check, user.update);
  // delete
  app.del('/user', auth.check, user.del);
  /*
   * ======================
   * ====== LEAGUE ========
   */
  // list
  // app.get('/leagues', auth.check, leagues.list);
  /*
   * ======================
   * ====== TEAMS =========
   */
  // list
  // app.get('/teams', auth.check, teams.list);
  /*
   * ======================
   * ====== PLAYERS =======
   */

}
