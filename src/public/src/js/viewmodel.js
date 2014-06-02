function Team(obj){
	var self = this;
	self._id = obj.id
	self.team_key = obj.team_key;
	self.name = obj.name;
	self.league = obj.league;
	self.game = obj.game;
	self.active = ko.observable(obj.active);
	self.settings = {
		probable_player: ko.observable(obj.settings.probable_player),
		questionable_player: ko.observable(obj.settings.questionable_player),
		out_player: ko.observable(obj.settings.out_player),
		lack_of_players: ko.observable(obj.settings.lack_of_players),
		ask_qb: ko.observable(obj.settings.ask_qb),
		ask_rb: ko.observable(obj.settings.ask_rb),
		ask_wr: ko.observable(obj.settings.ask_wr),
		ask_te: ko.observable(obj.settings.ask_te),
		ask_def: ko.observable(obj.settings.ask_def),
		ask_k: ko.observable(obj.settings.ask_k),
		emails: ko.observable(obj.settings.emails),
		injury_reports: ko.observable(obj.settings.injury_reports) 
	};
}

function Player(obj){
	var self = this;
	_id = obj.id;
	self.team_key = obj.team_key;
	self.team_name = obj.team_name;
	self.player_key = obj.player_key;
	self.player_full_name = obj.name.full;
	self.player_first = obj.name.first;
	self.player_last = obj.name.last;
	self.position = obj.eligible_positions.position;
	self.selected_position = ko.observable(obj.selected_position.position)
	self.selected_position.subscribe(function(val){
		utils.issue("PUT", "method/lineup", {
			player_key: self.player_key,
			team_key: self.team_key,
			move_to: val
		},function(err,stat,text){
			console.log(err,stat,text)
		});
		console.log('player '+self.player_full_name+" was moved to "+val)
	})
	self.injury_status = obj.status ? obj.status : "A";
	self.bye_week = obj.bye_weeks.week;
	self.undroppable = obj.undroppable;
	self.image_url = obj.image_url;
	self.projected_points = {};
	self.settings = {
		never_drop: ko.observable(obj.settings.never_drop),
		start_if_probable: ko.observable(obj.settings.start_if_probable),
		start_if_questionable: ko.observable(obj.settings.start_if_questionable)
	};
}

function League(obj){
	this._id = obj.id;
	this.league_key = obj.league_key;
	this.name = obj.name;
	this.url = obj.url;
}

function position(obj){
	var self = this;
	self.position = obj.position;
	self.count = obj.count;
	self.starters = ko.computed(function(){
		var numberOfStarters = ko.utils.arrayFilter(fantasyslackr.viewmodel.selectedPlayers(),function(pos){
			return ((pos.selected_position() == pos.position) && (pos.selected_position() == self.position))
		})
		return numberOfStarters.length
	});
	self.team_key = obj.team_key;
}


function AppViewModel() {
	var self = this;
	var user = {}

	// Laundry list of observables
	self.modalStatus = ko.observable('none');
	self.displayPage = ko.observable('login').extend({logChange: "first name"});
	self.showPanel = ko.observable('team')
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
	self.signupPass.subscribeCheckPass(function(status){self.signupPassStatus(status)});

	self.players = ko.observableArray([]);
	self.teams = ko.observableArray([]);
	self.leagues = ko.observableArray([]);
	self.positions = ko.observableArray([]);
	self.activityEntries = ko.observableArray([]);

	// selected team changes UI
	self.selectedTeam = ko.observable();
	self.selectedPlayer = ko.observable();
	self.selectedPlayers = ko.computed(function(){
		return ko.utils.arrayFilter(self.players(),function(player){
			return player.team_key == self.selectedTeam().team_key;
		})
	})


	// modal controls

	self.showSignup = function(){
		self.modalStatus('signup');
	}
	self.closeModals = function(){
		self.modalStatus('none');
	}
	self.showAbout = function(){
		self.modalStatus('about');
	}
	self.switchPanel = function(data){
		console.log(data)
	}


	// login/signup controls

	self.login = function(uname,upass){
		var username, password;
		if (uname && upass){
			username = uname;
			password = upass;
		} else {
			username = self.loginName();
			password = self.loginPass();
		}
		utils.issue("POST","user/login",{
		uname: username,
		upass: password
		},function(err,stat,text){
			if (stat == 200) {
				var data = JSON.parse(text);
				utils.setCredentials(username,data.session)

				self.loginFeedback('');
				self.loginName('');
				self.loginPass('');
				
				self.getUserData(data);
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
		utils.issue("POST","method/createNewUser",{
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
			console.log(new Date().getTime())
			utils.issue("POST","method/login",{
				uname: self.signupName(),
				upass: self.signupPass()
			},function(err,stat,text){
				if (stat == 200) {
					var data = JSON.parse(text);
					utils.setCredentials(data.name,data.currentLogin);

					
					
					self.modalStatus('');
				} else if (stat == 400) {
					self.shake('login')
				} else {
					self.modalStatus('server-error');
				}
			})
		},2000)
		console.log(new Date().getTime())
	}
	
	self.getUserData = function(data){
		async.parallel({
			setPlayers:function(cb){
				async.each(data.players,function(p,nP){
					self.players.push(new Player(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setTeams:function(cb){
				async.each(data.teams,function(p,nP){
					self.teams.push(new Team(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setLeagues: function(cb){
				async.each(data.leagues,function(p,nP){
					self.leagues.push(new League(p));
					nP();
				},function(){
					cb(null);
				});
			},
			setActivity: function(cb){
				async.each(data.activity,function(p,nP){
					self.activityEntries.push(p);
					nP();
				},function(){
					cb(null);
				});
			}
		},function(){
			self.displayPage('dashboard');
		});
	}
	// 	if (this.roster.length > 0){
	// 	$(this.roster).each(function(indexi, obji){
	// 		this.team_key = thisTeamKey;
	// 		this.team_name = thisTeamName;
	// 		self.players.push(new player(this))
	// 	});
	// }
	self.startDemo = function(){
		self.login('name','pass');
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
	self.selectPlayer = function(data){
		self.showPanel('player')
		self.selectedPlayer(data.player_key);
	}

}

var fantasyslackr = { viewmodel : new AppViewModel()}

ko.applyBindings(fantasyslackr.viewmodel);