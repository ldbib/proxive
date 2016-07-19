
'use strict';

var qs    = require('querystring');
var url   = require('url');

module.exports = function(config) {
  return function(req, res) {
    var body = '';

    req.on('data', function (data) {
      body += data;

      // Too much POST data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6) {
        req.connection.destroy();
      }
    });

    req.on('end', function () {
      var post = qs.parse(body);

      if(req.url === '/login') {
        /*
        if(organizations.has(post['organization'])) {
          req.cookies.set('org', post['organization'], {domain: '.' + req.headers.host});
        }
        if(post['password'] === 'drowssap') {
          req.cookies.set('pw', '1337', {signed: true, httpOnly: true, domain: '.' + req.headers.host});
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/'
          });
        } else {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=password'
          });
        }
        res.end();
        */
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=not-finished-yet'
        });
        res.end();
      }
    });
  };
};
