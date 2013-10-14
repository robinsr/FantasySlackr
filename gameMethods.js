var oauth =         require('./oauth'),
    db =            require('./dbModule'),
    objectid =      require('mongodb').ObjectID,
    xpath =         require('xpath'), 
    dom =           require('xmldom').DOMParser,
    obj =           require('./objects'),
    async =         require('async'),
    u =             require('underscore');


var apiUrls = {
    users: 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games',
    game: 'http://fantasysports.yahooapis.com/fantasy/v2/game/',  // add game_key
    leagueA: 'http://fantasysports.yahooapis.com/fantasy/v2/league/',
    leagueB: '/settings',
    team: 'http://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games/teams',
    rosterA:'http://fantasysports.yahooapis.com/fantasy/v2/team/',
    rosterB:'/roster'
}


function setupRoster(user_object,newTeam,token,secret,cb){
    var url = apiUrls.rosterA+newTeam.team_key+apiUrls.rosterB
    oauth.getYahoo(url,token,secret,function(err,result){
        if (err) {
            db.updateUserDb(username,{initial_setup:"unsuccessfull"},function(){});
        } else {
            var sample = {
                _id: new objectid(),
                url:url,
                resource: "roster",
                called_for_user: user_object.name,
                response: result
            }
            db.sampleResponses(sample);
            var doc = new dom().parseFromString(result);

            var players = xpath.select('//player',doc);

            async.each(players,function(player,b){
                console.log(xpath.select('selected_position/position/text()',player).toString());
                newTeam.roster.push(new obj.player({
                    id: new objectid(),
                    player_key:     xpath.select('player_key/text()',player).toString(),
                    full:           xpath.select('name/full/text()',player).toString(),
                    first:          xpath.select('name/first/text()',player).toString(),
                    last:           xpath.select('name/last/text()',player).toString(),
                    position:       xpath.select('eligible_positions/position/text()',player).toString(),
                    selected_position: xpath.select('selected_position/position/text()',player).toString(),
                    injury_status: 'unknown',
                    bye_week:       xpath.select('bye_weeks/week/text()',player).toString(),
                    undroppable:    xpath.select('is_undroppable/text()',player).toString(),
                    image_url:      xpath.select('image_url/text()',player).toString()
                }))
                b(null);
            },
            function(err){
                if (err){
                    cb()
                } else {
                    db.addToTeams(newTeam);
                    cb()
                }
            })
        }
    }) 
}
function updateRoster(user_object,team_key,token,secret,cb){
    var url = apiUrls.rosterA+team_key+apiUrls.rosterB
    oauth.getYahoo(url,token,secret,function(err,result){
        if (err) {
            console.log('error updateRoster')
        } else {

        }
    })
}
function setupLeague(user_object,league_key,token,secret,cb){
    console.log(league_key);
    db.getLeague(league_key,function(err,result){
        if (err || result != null){
            cb(1)
        } else {
            var url = apiUrls.leagueA + league_key + apiUrls.leagueB;
            oauth.getYahoo(url,token,secret,function(err,result){
                if (err) {
                    db.updateUserDb(username,{initial_setup:"unsuccessfull"},function(){});
                } else {
                    var sample = {
                        _id: new objectid(),
                        url:url,
                        resource: "league/settings",
                        called_for_user: user_object.name,
                        response: result
                    }
                    db.sampleResponses(sample);

                    var doc = new dom().parseFromString(result);

                    var league = {
                        _id : new objectid(),
                        league_key : xpath.select('//league/league_key/text()',doc).toString(),
                        name: xpath.select('//league/name/text()',doc).toString(),
                        url: xpath.select('//league/url/text()',doc).toString(),
                        roster_positions: []
                    }

                    var positions = xpath.select('//roster_position',doc);
                    async.each(positions,function(pl,next){
                        league.roster_positions.push({
                            position: xpath.select('position/text()',pl).toString(),
                            count:xpath.select('count/text()',pl).toString()
                        })
                        next();
                    },function(err){
                        db.addToLeagues(league);
                        cb(null);
                    })
                }
            });
        } 
    });
}
module.exports.setupTeams = function (user_object,token,secret,cb){
    oauth.getYahoo(apiUrls.team,token,secret,function(err,result){
        if (err){
            db.updateUserDb(username,{initial_setup:"unsuccessfull"},function(){});
        } else {
            var sample = {
                _id: new objectid(),
                url:apiUrls.team,
                resource: "games/teams",
                called_for_user: user_object.name,
                response: result
            }
            db.sampleResponses(sample);

            var doc = new dom().parseFromString(result);
            var teams = xpath.select('//team',doc);            

            async.each(teams,function(team,c){
               var newTeam = new obj.team({
                    id: new objectid(),
                    owner:user_object._id,
                    team_key: xpath.select('team_key/text()',team).toString(),
                    name: xpath.select('name/text()',team).toString()
                });
                async.parallel([
                    function(parallel_cb){
                        setupRoster(user_object,newTeam,token,secret,function(){
                            parallel_cb(null,'one');
                        });
                    },
                    function(parallel_cb){
                        setupLeague(user_object,newTeam.league,token,secret,function(){
                            parallel_cb(null,'two');
                        })
                    }
                ],function(err,result){
                    c();
                }) 
            },function(err){
               if (err){
                   cb(1);
               } else {
                   cb(null);
               }
            })
        }
    });
}
function updateRoster(user_object,team_key,token,secret,cb){
    var url = apiUrls.rosterA+team_key+apiUrls.rosterB
    oauth.getYahoo(url,token,secret,function(err,result){
        if (err) {
            db.updateUserDb(username,{initial_setup:"unsuccessfull"},function(){});
        } else {
            var sample = {
                _id: new objectid(),
                url:url,
                resource: "roster",
                called_for_user: user_object.name,
                response: result
            }
            db.sampleResponses(sample);

            var upToDateRoster = [];

            var doc = new dom().parseFromString(result);
            var players = xpath.select('//player',doc);
            async.each(players,function(player,b){
                console.log(xpath.select('selected_position/position/text()',player).toString());
                upToDateRoster.push(new obj.player({
                    id: new objectid(),
                    player_key:     xpath.select('player_key/text()',player).toString(),
                    full:           xpath.select('name/full/text()',player).toString(),
                    first:          xpath.select('name/first/text()',player).toString(),
                    last:           xpath.select('name/last/text()',player).toString(),
                    position:       xpath.select('eligible_positions/position/text()',player).toString(),
                    selected_position: xpath.select('selected_position/position/text()',player).toString(),
                    injury_status: 'unknown',
                    bye_week:       parseInt(xpath.select('bye_weeks/week/text()',player).toString()),
                    undroppable:    xpath.select('is_undroppable/text()',player).toString(),
                    image_url:      xpath.select('image_url/text()',player).toString()
                }))
                b(null);
            },
            function(err){
                if (err){
                    cb()
                } else {
                    db.addToTeams(newTeam);
                    cb()
                }
            })
        }
    }) 
}