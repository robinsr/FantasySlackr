var config = require(__dirname + "/../../src/confg");

module.exports = {
    settings : {
        never_drop : true,
        start_if_probable : true,
        start_if_questionable : false
    },
    player_key : "314.p.25741",
    player_id : "25741",
    name : {
        full : "Doug Martin",
        first : "Doug",
        last : "Martin",
        ascii_first : "Doug",
        ascii_last : "Martin"
    },
    status : "O",
    editorial_player_key : "nfl.p.25741",
    editorial_team_key : "nfl.t.27",
    editorial_team_full_name : "Tampa Bay Buccaneers",
    editorial_team_abbr : "TB",
    bye_weeks : {
        week : "5"
    },
    uniform_number : "22",
    display_position : "RB",
    headshot : {
        url : "http://l.yimg.com/iu/api/res/1.2/cswYGKCvMEi3DiKAAdW9dQ--/YXBwaWQ9eXZpZGVvO2NoPTg2MDtjcj0xO2N3PTY1OTtkeD0xO2R5PTE7Zmk9dWxjcm9wO2g9NjA7cT0xMDA7dz00Ng--/http://l.yimg.com/j/assets/i/us/sp/v/nfl/players_l/20120913/25741.jpg",
        size : "small"
    },
    image_url : "http://l.yimg.com/iu/api/res/1.2/cswYGKCvMEi3DiKAAdW9dQ--/YXBwaWQ9eXZpZGVvO2NoPTg2MDtjcj0xO2N3PTY1OTtkeD0xO2R5PTE7Zmk9dWxjcm9wO2g9NjA7cT0xMDA7dz00Ng--/http://l.yimg.com/j/assets/i/us/sp/v/nfl/players_l/20120913/25741.jpg",
    is_undroppable : "0",
    position_type : "O",
    eligible_positions : {
        position : "RB"
    },
    has_player_notes : "1",
    has_recent_player_notes : "1",
    selected_position : {
        coverage_type : "week",
        week : "10",
        position : "RB"
    },
    owner : new ObjectId(config.test.userID),
    team_key : "314.l.348736.t.1",
    retrieved : 1383795755009,
    _id : new ObjectId()
};
