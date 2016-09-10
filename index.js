var TelegramBot = require('node-telegram-bot-api');

var token = '280956301:AAGSeA8De_HcjKLDhgwIt8odRILZhJf8sj4';

// Setup polling way
var bot = new TelegramBot(token, {polling: true});

bot.onText(/\/start/, function(msg, match) {
    console.log(msg);
    var fromId = msg.chat.id;
    bot.sendMessage(fromId, "Hello! Please type \/help for more options.");
});

bot.onText(/\/help/, function(msg, match) {
    console.log(msg);
    
}
