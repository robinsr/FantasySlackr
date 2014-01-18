###FantasySlackr

===

Web service to automate your fantasy football lineups so you don't have to pay so much attention

===

![I love fantasy football!](https://dl.dropboxusercontent.com/u/37459575/imgres.jpg)
#Overview

FantasySlackr interfaces with Yahoo fantasy football via their publicly available API to manage a user's fantasy football roster. The project will have these main goals:
* Guarantee that a user's roster will be filled with viable players each week. This requires:
  * Changing players from 'benched' status to 'active' status
  * Anticipating lack of viable players due to bye weeks
  * Replacing players whose injury status is 'Out'
  * Navigating the waivers list and list of free-agents to determine alternate viable players
  * Adding players to the user's roster and making claims on waivers 
* Making strategic moves to better the user's roster, including
  * Determining strong and weak points in the user's roster and opponents' rosters
  * Suggesting beneficial trades with opponents
  * Suggesting beneficial changes to the roster
* Analyzing player data from yahoo to determine over- and under-performing players 

## RoadMap

* ~~Integrate Mashape oauthModule~~
* ~~Create front-end prototype using knockout~~
* Move server over to expressjs
* Create routes for each model so the front-end can be used to do normal team maintenance operations
* Refactor "normal team maintenance operations" logic into auto-maintenance logic





### links

[Yahoo Fantasy Sports API](http://developer.yahoo.com/fantasysports/)

[FantasySlackr](demos.ethernetbucket.com/FantasySlackr) (not always available, sorry)