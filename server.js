
/**
 *
 * Proxive
 *
 * Copyright 2016 Landstinget Dalarna Bibliotek och Informationscentral
 * Copyright 2016 Emil Hemdal <https://github.com/emilhem>
 *
 * Proxive is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Proxive is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Proxive.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

'use strict';

var http          = require('http');
var Cookies       = require('cookies');
var Unblocker     = require('unblocker');
var mysql         = require('mysql');
var fs            = require('fs');
var qs            = require('querystring');
var url           = require('url');
var path          = require('path');

function setupServer(config) {

  var pool = mysql.createPool({
    connectionLimit:  10,
    host:             config.mysql.host,
    port:             (config.mysql.port || 3306),
    user:             config.mysql.user,
    password:         config.mysql.pass,
    database:         config.mysql.database,
    charset:          'utf8mb4'
  });

  pool.getConnection(function(err, connection) {
    if(err) {
      console.error(err);
      throw 'MySQL not set up properly!';
    }
    connection.query('SHOW TABLES;', function(err) {
      if(err) {
        console.error(err);
        throw 'MySQL not set up properly!';
      }
      console.log('MySQL activated!');
      connection.release();
    });
  });

  config.getRealUrl = Unblocker.getRealUrlPrefixed({domain: config.proxyServer.domain});

  config.mysql = pool;

  config.redis = require("redis");
  config.redisClient = config.redis.createClient(config.redisConfig);

  config.organizations = require('./lib/organizations.js')(config);
  config.users = require('./lib/users.js')(config);

  config.pugGen = require('./lib/pugGenerator.js')(config);
  config.emailer = require('./lib/emailer.js')(config);

  var get  = require('./lib/get.js')(config);
  var post = require('./lib/post.js')(config);

  var unblockerConfig = {
    prefix: false,
    domainPrefixing: true,
    domain: config.proxyServer.domain,
    specialRedirects: config.specialRedirects
  };

  var unblockerConfigSpecial = {
    prefix: false,
    domainPrefixing: true,
    domain: config.proxyServer.domain,
    specialRedirects: config.specialRedirects,
    mysql: pool,
    redisClient: config.redisClient,
    pugGen: config.pugGen,
    webmasterEmail: config.webmasterEmail
  };

  unblockerConfig.requestMiddleware = [
    require('./lib/whitelist.js')(unblockerConfigSpecial),
    require('./lib/special-redirects.js')(unblockerConfig),
    require('./lib/otool.js')(unblockerConfigSpecial)
  ];
  unblockerConfig.responseMiddleware = [
    require('./lib/logging.js')(unblockerConfigSpecial)
  ];

  var unblocker = new Unblocker(unblockerConfig);

  // Proxy server
  http.createServer(function(req, res) {

    res.cookies = req.cookies = new Cookies( req, res );

    if(req.cookies.get('login')) {
      var cookieInfo = config.users.validateHmac(req.cookies.get('login'));
      if(cookieInfo) {
        config.users.validateSession(cookieInfo.user, cookieInfo.data, function(err) {
          if(err) {
            console.error(err);
            if(err === 'invalid-user' || err === 'no-user') {
              res.writeHead(302, {
                location: (config.https ? 'https://' : 'http://') + config.loginServer.domain + '/?redirect=' + encodeURIComponent(config.getRealUrl(req.headers.host, req.url))
              });
              return res.end();
            } else {
              res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
              return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid valideringen av inloggningsuppgifterna!',
                message: 'Prova att ladda om sidan om en liten stund.'}));
            }
          }
          req.userId = cookieInfo.user;
          config.organizations.getConnectOrgIdAndIp(cookieInfo.user, function(err, orgId, orgIp) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
              return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid valideringen av inloggningsuppgifterna!',
                message: 'Prova att ladda om sidan om en liten stund.'}));
            }
            req.organizationId  = orgId;
            req.ipToConnectWith = orgIp;
            unblocker(req, res, function(err) {
              // this callback will be fired for any request that unblocker does not serve
              var headers = {'content-type': 'text/html; charset=utf-8'};
              if (err) {
                console.error(err.stack || err.message);
                console.error(err);
                res.writeHead(500, headers);
                return res.end(config.pugGen.run['500.pug']({title: 'Ett fel hände vid hämtandet av sidan!',
                  message: 'Ett fel inträffade! Är du säker på att adressen ska fungera? Kontakta i så fall emil.hemdal@ltdalarna.se'}));
              }
              res.writeHead(404, headers);
              return res.end(config.pugGen.run['404.pug']({title: 'Ett fel hände vid hämtandet av sidan!',
                message: 'Ett fel inträffade! Är du säker på att adressen ska fungera? Kontakta i så fall emil.hemdal@ltdalarna.se'}));
            });
          });
        });
        return;
      }
    }
    res.writeHead(302, {
      location: (config.https ? 'https://' : 'http://') + config.loginServer.domain + '/?redirect=' + encodeURIComponent(config.getRealUrl(req.headers.host, req.url))
    });
    res.end();
  }).listen(config.proxyServer.port, '127.0.0.1');

  // Loginserver
  http.createServer(function(req, res) {
    res.cookies = req.cookies = new Cookies( req, res );
    if(req.method === 'POST') {
      post(req, res);
    } else if(req.method === 'GET') {
      get(req, res);
    } else {
      res.writeHead(405, {
        'content-type': 'text/plain; charset=utf-8'
      });
      res.end('Method not supported!');
    }
  }).listen(config.loginServer.port, '127.0.0.1');
}

fs.readFile(path.join(__dirname, 'config.json'), function(err, data) {
  if(err) {
    throw 'config.json couldn\'t be loaded!';
  }
  setupServer(JSON.parse(data));
});
