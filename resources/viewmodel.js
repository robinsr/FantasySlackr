function team(obj){
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

function player(obj){
	_id = obj.id;
	this.team_key = obj.team_key;
	this.player_key = obj.player_key;
	this.player_full_name = obj.player_full_name;
	this.player_first = obj.player_first;
	this.player_last = obj.player_last;
	this.position = obj.position;
	this.selected_position = ko.observable(obj.selected_position);
	this.injury_status = obj.injury_status;
	this.bye_week = obj.bye_week;
	this.undroppable = obj.undroppable;
	this.projected_points = {};
	this.settings = {
		never_drop: ko.observable(obj.settings.never_drop),
		start_if_probable: ko.observable(obj.settings.start_if_probable),
		start_if_questionable: ko.observable(obj.settings.start_if_questionable)
	};
}

function league(obj){
	this._id = obj.id;
	this.league_key = obj.league_key;
	this.name = obj.name;
	this.url = obj.url;
}


function AppViewModel() {
	var self = this;
	var user = {}

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
	self.signupPass.subscribeCheckPass(function(status){self.signupPassStatus(status)});

	self.players = ko.observableArray([]);
	self.teams = ko.observableArray([]);
	self.leagues = ko.observableArray([]);

	// selected team changes UI
	self.selectedTeam = ko.observable();
	self.selectedPlayers = ko.computed(function(){
		return ko.utils.arrayFilter(self.players(),function(player){
			return player.team_key == self.selectedTeam().team_key;
		})
	})


///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

//  FOR THE SAKE OF FIGURING OUT WHAT THE F I WAS DOING......


		// THIS COMPUTED ARRAY RETURNS ALL THE PLAYERS THAT ARE IN THE SELECTED TEAM AND HAVE A SELECTE_POSITION
		// THE SAME AS THEIR POSITION. ie THEY ARE STARTERS AND NOT BENCHED
	self.startingPlayers = ko.computed(function(){
		return ko.utils.arrayFilter(self.players(),function(pos){
			return ((pos.selected_position() == pos.position) && (pos.team_key == self.selectedTeam().team_key))
		})
	})

		// THIS FUNCTION ATTEMPS TO DETERMINE OF THERE ARE TOO MANY PLAYERS STARTING FOR EACH POSITION
		// IT WORKS BUT ITS NOT OBSERVABLE SO ITS KINDA USELESS FOR RIGHT NOW
	self.startingPlayers.subscribe(function(value){
		//console.log(value);
		var positions = {};
		$(value).each(function(){
			if (typeof self.psotitionLimit()[this.position] == 'undefined'){
				self.psotitionLimit()[this.position] = 1
			} else {
				self.psotitionLimit()[this.position]++
			}
		})
		for (n in self.psotitionLimit()){
			//console.log(n,positions[n])
			var positionLimit = $.map(self.selectedTeam().league.roster_positions, function(obj) {
			    if(obj.position === n)
			         return obj.count; // or return obj.name, whatever.
			});
			if (self.psotitionLimit()[n] > positionLimit){
				console.log('too many '+n)
			}
		}
	})

		// THIS COMPUTED GETS ALL THE QBs STARTING
		// I WOULF REALLY LIKE IT IF FUTURE ME COULD FIND A WAY TO MAKE AN ALL-ENCOMASING FUNCTION THAT
		// MAKES FUNCTIONS LIKE THIS FOR EACH POSITION IRRELEVANT. THAT IS, SOMETHING THAT MAKES OBSERVABLES
		// FOR EACH POSITION AND HOW MAY STARTERS THAT POSITION HAS
	self.startingQB = ko.computed(function(){
		return ko.utils.arrayFilter(self.players(),function(pos){
			return ((pos.selected_position() == "QB") && (pos.team_key == self.selectedTeam().team_key))
		})
	})

		// SAME IDEA AS ABOVE. THIS FUNCTION FINDS THE MAX AMOUNT OF PLAYERS ALLOWED FOR THE QB POSITION
		// DETERMINED BY THE USERS LEAGUE SETTINGS
	self.limitQB = ko.computed(function(){
		return ko.arrayFilter(self.selectedTeam().league.roster_positions(),function(pos){
			if (pos.position == "QB"){
				return pos.count()
			}
		})
	})

		// end bull shit

///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////////////////////////////

	

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
				var data = JSON.parse(text);
				user.session = data.session;
				user.name = self.loginName();

				self.loginFeedback('');
				self.loginName('');
				self.loginPass('');
				
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
			console.log(new Date().getTime())
			utils.issue("method/login",{
				uname: self.signupName(),
				upass: self.signupPass()
			},function(err,stat,text){
				if (stat == 200) {
					var data = JSON.parse(text);
					user.session = data.session;
					user.name = self.signupName();
					self.getUserData();
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
	self.getUserData = function(){
		utils.issue("method/getUserData", {
			uname: user.name,
			session: user.session
		},function(err,stat,text){
			if (err || stat != 200){
				modalStatus('server-error')
			} else {
				var data = JSON.parse(text);
				$(data.teams).each(function(index, obj){
					var thisTeamKey = this.team_key;
					self.teams.push(new team(this))
					if (this.roster.length > 0){
						$(this.roster).each(function(indexi, obji){
							this.team_key = thisTeamKey;
							self.players.push(new player(this))
						});
					}
				});
				self.displayPage('dashboard');
			}
		})
	}

	self.lackOfPlayersOptions = ko.observableArray([
		{
			name: "Replace Player on Bye", 
			value: "replace_bye"
		},{
	    	name: "Replace Injured Player",
	    	value: "replace_injured"
	    },{
	    	name: "Ask before doing anything",
	    	value: "ask"
	    },{
	    	name: "Do Nothing",
	    	value: "do_nothing"
	    }
	])


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