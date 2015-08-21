/**
 * New node file
 */

var domain = require('domain');
var server = require('./server');

var d = domain.create();
d.add(server);

d.on('error', function (err) {
    console.error("domain catch error:",err);
});

d.run(server.start());