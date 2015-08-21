var message = require('../packages/message')();

var msg = message.createEventMsg("test","test","test");
console.info(msg);