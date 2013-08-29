function AppViewModel() {
  var self = this;


  // Laundry list of observables

  self.modalStatus = ko.observable('none');
  self.displayPage = ko.observable('login');
  self.loginName = ko.observable();
  self.loginPass = ko.observable();
  self.signupName = ko.observable();
  self.signupEmail = ko.observable();
  self.signupPass = ko.observable();


  // modal controls

  self.showSignup = function(){
    self.modalStatus('signup');
  }
  self.closeModals = function(){
    self.modalStatus('none');
  }


  // login/signup controls

  self.login = function(){
    utils.issue("method/login",{
      uname: self.loginName(),
      upass: self.loginPass()
      },function(err,stat,text){
        if (stat == 200) {
          var data = JSON.parse(test);
          self.session = data.session;
        } else if (stat == 400) {
          self.shake('login')
        } else {
          self.modalStatus('server-error');
        }
    })
  }
  self.signup = function(){
    console.log('runngin');
    utils.issue("method/createNewUser",{
      uname: self.signupName(),
      uemail: self.signupEmail(),
      upass: self.signupPass()
      },function(err,stat,text){
        console.log(err,stat,text)
    })
  }

}

var fantasyslackr = { viewmodel : new AppViewModel()}

ko.applyBindings(fantasyslackr.viewmodel);