
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:post');

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

      if(req.url === '/loginWithUsername') {
        debug('/loginWithUsername');
        if(!post.organization) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-organization'
          });
          res.end();
        } else if(!post.username) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-username'
          });
          res.end();
        } else if(!post.password) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-password'
          });
          res.end();
        } else {
          config.users.loginUsername(post.organization, post.username, post.password, function(err, user) {
            if(err) {
              if(err === 'no-user') {
                res.writeHead(302, {
                  location: 'http://'+req.headers.host+'/?err=user-not-found'
                });
                res.end();
              } else {
                console.error(err);
                res.writeHead(302, {
                  location: 'http://'+req.headers.host+'/?err=error-occured'
                });
                res.end();
              }
              return;
            }
            // Set cookie for account security
            req.cookies.set('login.sec', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 3600, 'secure'), {
              domain: '.' + req.headers.host,
              httpOnly: true,
              secure: (config.development ? false : true)
            });
            // Set cookie for browsing
            req.cookies.set('login', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 3600), {
              domain: '.' + req.headers.host,
              httpOnly: true
            });
            res.writeHead(302, {
              location: 'http://'+req.headers.host+'/'
            });
            res.end();
          });
        }
      } else if(req.url === '/loginWithEmail') {
        debug('/loginWithEmail');
        if(!post.organization) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-organization'
          });
          res.end();
        } else if(!post.username) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-username'
          });
          res.end();
        } else if(!post.password) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-password'
          });
          res.end();
        } else {
          config.users.loginEmail(post.email, post.password, function(err, user) {
            if(err) {
              if(err === 'no-user') {
                res.writeHead(302, {
                  location: 'http://'+req.headers.host+'/?err=user-not-found'
                });
                res.end();
              } else {
                console.error(err);
                res.writeHead(302, {
                  location: 'http://'+req.headers.host+'/?err=error-occured'
                });
                res.end();
              }
              return;
            }
            // Set cookie for account security
            req.cookies.set('login.sec', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 3600, 'secure'), {
              domain: '.' + req.headers.host,
              httpOnly: true,
              secure: (config.development ? false : true)
            });
            // Set cookie for browsing
            req.cookies.set('login', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 3600), {
              domain: '.' + req.headers.host,
              httpOnly: true
            });
            res.writeHead(302, {
              location: 'http://'+req.headers.host+'/'
            });
            res.end();
          });
        }
      }
    });
  };
};
