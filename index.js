// DATABASE PART
var _ = require('underscore');
var firebase = require('firebase');
var request = require('request');
var busstops = require('./busstops.json');
var venues = require('./venue.json');
var busmap = require('./busmap.json');

var config = {
    apiKey: "AIzaSyAqqVtM9-jYlbImjgAw7Mk4rig5SGe2lN4",
    authDomain: "hackfest2016-e502a.firebaseapp.com",
    databaseURL: "https://hackfest2016-e502a.firebaseio.com",
    storageBucket: "hackfest2016-e502a.appspot.com",
};

firebase.initializeApp(config);

var database = firebase.database();

// Helpers

function getBusName(id) {
    for (i in busstops) {
        if (busstops[i].id === id) {
            return busstops[i].name;
        }
    }
    return undefined;
}

function getBestRoute(r1,r2) {
    var best = {
        bus: undefined,
        bus_count: 0,
        dist: 10000,
    };
    var x,y;
    for (i in r1) {
        for (j in r2) {
            var start = r1[i];
            var end = r2[j];   
            if (best.dist > busmap[start][end].dist) {
                best = busmap[start][end];
                x = start;
                y = end
            }
        }
    }
    return [best,x,y];
};

function nearestBusStop(lat,long, c) {
    var results = []; 
    for (i in busstops) {
        var x = busstops[i];
        var l1 = busstops[i].lat;
        var l2 = busstops[i].long;
        var score = Math.pow(l1-lat, 2) + Math.pow(l2-long,2);

        x.score = score;
        results.push(x);
    }

    var new_res = _.sortBy(results,function(res) {
        return res.score;
    });
    return new_res.slice(0,c).map(function(res){
        return res.id;
    });
}

function time_to_text(time) {
    var hour = time / 100;
    var minutes = time % 100;
    var m = minutes === 0 ? "" : ":"+minutes;
    var end = hour < 12 ? "am" : "pm";
    return "" + (hour % 13) +  m + end;
}

function createNewUserLocation(userId, data) {
    return database.ref('/location/'+userId).set(data);
}

function getUserLocation(userId) {
    return database.ref('/location/'+userId).once('value');
}

function createNewUser(userId, data) {
    return database.ref('/users/'+userId).set(data);
}

function getUser(userId) {
    return database.ref('/users/'+userId).once('value');
}

// TELEGRAM BOT PART
var TelegramBot = require('node-telegram-bot-api');
// var token = '280956301:AAGSeA8De_HcjKLDhgwIt8odRILZhJf8sj4';
var token = '256388808:AAEHzOZUzMEUdxLVlGoWaLCTO2v0H6-KsSw';
var bot = new TelegramBot(token, {polling: true});

bot.onText(/\/start/, function(msg, match) {
	  var fromId = msg.chat.id;
	  bot.sendMessage(fromId, "Hello! Please type \/help for more options.");
});

bot.onText(/\/help/, function(msg, match) {
	  var fromId = msg.chat.id;
	  var resp = "HELP MEH";
	  bot.sendMessage(fromId, resp);
});

bot.onText(/\/timetable/, function(msg, match) {
    var fromId = msg.from.id;
    var chatId = msg.chat.id; 
    getUser(fromId).then(function(snapshot) {
        var user = snapshot.val(); 
        var time_sorted = _.sortBy(user, function(module) {
            return parseInt(module.StartTime);
        });
        
        var modules_by_day = _.groupBy(time_sorted, function(module) {
		        return module.DayCode;
		    });

        var text = _.map(modules_by_day, function(day) {
            var str = "<b>"+day[0].DayText + "</b>:\n";
            _.each(day, function(lesson) {
                str += lesson.ModuleCode + " " + lesson.LessonType + " - " + time_to_text(lesson.StartTime) + " to " + time_to_text(lesson.EndTime) + " @ " + lesson.Venue+ "\n";
            });
            return str;
        }).join("\n");

        bot.sendMessage(chatId, text, {parse_mode: 'HTML'});
    }); 
});

bot.on('location', function(msg) {    
    var chatId = msg.chat.id; 
    var fromId = msg.from.id;
    createNewUserLocation(fromId, msg.location);
    
    getUser(fromId).then(function(snapshot){
        var lessons = snapshot.val();
        var modules = _.map(lessons, function(lesson) {
            return lesson.Venue; 
        });
        var unique_modules = _.uniq(modules).map(function(item){
            return [item];
        }); 
        opts = {
            reply_markup: JSON.stringify(
                {
                    "one_time_keyboard": true,
                    "force_reply": true,
                    "keyboard": unique_modules
                }
            )}; 

        var chatId = msg.chat.id; 
        bot.sendMessage(chatId, "Where would you be going?", opts); 
    });
});

bot.on("message", function(msg) {
    if (msg.text !== undefined) {
        console.log(msg);
        var chatId = msg.chat.id;
        var fromId = msg.from.id;
        var text = msg.text;
        var regions = venues[text];
        getUserLocation(fromId).then(function(snapshot){
            var location = snapshot.val(); 
            var nearest_bus_stops = nearestBusStop(location.latitude,location.longitude, 2);
            var bestRoute = getBestRoute(nearest_bus_stops,regions);
            var bus = bestRoute[0];
            var start = bestRoute[1];
            var end = bestRoute[2];
            console.log(bus);
            if (bus.bus === "NA") {
                bot.sendMessage(chatId, "Simply walk there");
            } else {
                var str = "Take bus " + bus.bus + " "
                        + bus.dist + " stops from "
                        + getBusName(start) + " to " + getBusName(end);
                bot.sendMessage(chatId, str );
            }
        });
    }
});

bot.onText(/\/travel/, function(msg, matcdh) {
    bot.sendMessage(msg.chat.id, "Send me your location!");
});

bot.onText(/\/login/, function(msg, match) {
	  var fromId = msg.from.id;
	  var chatId = msg.chat.id;
	  var link = "https://ivle.nus.edu.sg/api/login/?apikey="+ivle_api_key+"&url=http://localhost:3000/callback?userID=" + fromId;
	  bot.sendMessage(chatId, "Hello! Please login here: " + link);
});

// WEB SERVER PART
var express = require('express');
var app = express();

var ivle_api_key = "Blx0HVxvOgkCqlfbnDMQI";

app.get('/callback', function(req, res) {
	  var userID = req.query.userID;
	  var token = req.query.token;
    bot.sendMessage(userID, "Successfully logged in! You can now access your timetable with \/timetable.");
    var url = "https://ivle.nus.edu.sg/api/Lapi.svc/Timetable_Student?APIKey="
            + ivle_api_key
            + "&AuthToken="
            + token
            + "&AcadYear="
            + "2016/2017"
            + "&Semester="
            + "1"; 
    request(url, function (error, response, body) {
        if (!error && response.statusCode == 200) {
            var timetable = JSON.parse(body);
            createNewUser(userID, timetable["Results"]); 
            res.send("ok");
        }
    }) 
});

app.listen(3000);
