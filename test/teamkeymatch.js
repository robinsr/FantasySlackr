var teststring = "<team_key>314.l.148766.t.1</team_key>";


var m = teststring.match(/(<team_key>)(.{16})(<\/team_key>)/);

console.log(m)