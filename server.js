
'use strict';

var http        = require('http');
var Unblocker   = require('unblocker');
var fs          = require('fs');
var path        = require('path');
var pugGen      = require('./lib/pugGenerator.js');

var config = {
  prefix: null,
  domainPrefixing: true,
  domain: 'u.fabicutv.com'
};


function setupServer(config) {
  var unblockerConfig = {
    prefix: false,
    domainPrefixing: true,
    domain: config.proxyServer.domain
  };

  var unblocker = new Unblocker(unblockerConfig);

  // Proxy server
  http.createServer(function(req, res) {
    // TODO: check logincookies!
    unblocker(req, res, function(err) {
      // this callback will be fired for any request that unblocker does not serve
      var headers = {'content-type': 'text/html'};
      if (err) {
        console.error(err.stack || err.message);
        console.error(err);
        res.writeHead(500, headers);
        return res.end(pugGen.run['500.pug']({title: 'Ett fel hände vid hämtandet av sidan!', message: 'Ett fel inträffade! Är du säker på att adressen ska fungera? Kontakta i så fall emil.hemdal@ltdalarna.se'}));
      }
      res.writeHead(404, headers);
      return res.end(pugGen.run['404.pug']({title: 'Ett fel hände vid hämtandet av sidan!', message: 'Ett fel inträffade! Är du säker på att adressen ska fungera? Kontakta i så fall emil.hemdal@ltdalarna.se'}));
    });
  }).listen(config.proxyServer.port, '127.0.0.1');

  // Loginserver
  http.createServer(function(req, res) {
    res.end('TODO');
  }).listen(config.loginServer.port, '127.0.0.1');
}

fs.readFile(path.join(__dirname, 'config.json'), function(err, data) {
  if(err) {
    throw 'config.json couldn\'t be loaded!';
  }
  setupServer(JSON.parse(data));
});
