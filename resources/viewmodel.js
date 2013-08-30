function AppViewModel() {
	var self = this;

	// Laundry list of observables
	self.modalStatus = ko.observable('none');
	self.displayPage = ko.observable('login');
	self.loginName = ko.observable();
	self.loginPass = ko.observable();
	
	self.yahooValidated = ko.observable('Nothing yet');
	self.signupFeedback = ko.observable('');
	self.loginFeedback = ko.observable('');


	// signup form name handlers
	self.signupName = ko.observable();
	self.signupNameStatus = ko.observable();
	self.signupName.subscribeAjaxIcons("name",function(status){self.signupNameStatus(status)});

	// signup form email handlers
	self.signupEmail = ko.observable();
	self.signupEmailStatus = ko.observable();
	self.signupEmail.subscribeAjaxIcons("email",function(status){self.signupEmailStatus(status)});

	// signup form password handlers
	self.signupPass = ko.observable();
	self.signupPassStatus = ko.observable();
	self.signupPass.subscribeCheckPass(function(status){self.signupPassStatus(status)})






	// modal controls

	self.showSignup = function(){
		self.modalStatus('signup');
	}
	self.closeModals = function(){
		self.modalStatus('none');
	}


	// login/signup controls

	self.login = function(uname,upass){
		utils.issue("method/login",{
		uname: self.loginName(),
		upass: self.loginPass()
		},function(err,stat,text){
			if (stat == 200) {
				self.loginFeedback('')
				self.loginName(''),
				self.loginPass('')
				var data = JSON.parse(text);
				self.session = data.session;
				self.getUserData();
			} else if (stat == 400) {
				var data = JSON.parse(text)
				var missing = data.RequestParameterMissing;
				if (missing) {
					self.loginFeedback('Missing Username or Password')
				} else {
					var error = data.error;
					self.loginFeedback(error);
				}
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
			if (stat == 200) {
				var data = JSON.parse(text);
				var oauthURL = data.url;
				open(oauthURL,"FantasySlackr", "width=600,height=450");
			} else if (stat == 400) {
				var data = JSON.parse(text);
				if (data.error){
					self.signupFeedback(data.error);
				}
				self.shake('signup')
			} else {
				self.modalStatus('server-error');
			}
		})
	}
	self.yahooValidated = function(){
		setTimeout(function(){
			utils.issue("method/login",{
				uname: self.signupName(),
				upass: self.signupPass()
			},function(err,stat,text){
				if (stat == 200) {
					var data = JSON.parse(text);
					self.session = data.session;
					self.getUserData();
				} else if (stat == 400) {
					self.shake('login')
				} else {
					self.modalStatus('server-error');
				}
			})
		},300)
	}
	self.getUserData = function(){
		console.log('would get user data at this point')
	}

	self.test = function(){
		open("resources/closewindow.html","test text", "width=400,height=200")
	}

	// ui functions

	self.shake = ko.observable();
	self.shake.subscribe(function(value){
		if (value != ''){
			setTimeout(function(){
				self.resetShake();
			},400)
		}
	});
	self.resetShake = function(){
		self.shake('');
	}

}

var fantasyslackr = { viewmodel : new AppViewModel()}

ko.applyBindings(fantasyslackr.viewmodel);