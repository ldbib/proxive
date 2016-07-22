
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:post');

module.exports = function(config) {
  function handleLoginCallback(err, user, req, res) {
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
    config.users.createSession(user.userId, function(err, sessionKey) {
      if(err) {
        console.error(err);
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=error-occured'
        });
        return res.end();
      }
      // Set cookie for account security for thirty days
      req.cookies.set('login.sec', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 2592000, 'secure:'+sessionKey), {
        domain: '.' + req.headers.host,
        httpOnly: true,
        secure: (config.development ? false : true)
      });
      // Set cookie for browsing for 4 hours
      req.cookies.set('login', config.users.hmac(user.userId, Math.floor(Date.now()/1000) + 14400, sessionKey), {
        domain: '.' + req.headers.host,
        httpOnly: true
      });
      res.writeHead(302, {
        location: 'http://'+req.headers.host+'/'
      });
      res.end();
    });
  }

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
            handleLoginCallback(err, user, req, res);
          });
        }
      } else if(req.url === '/loginWithEmail') {
        debug('/loginWithEmail');
        if(!post.email) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-email'
          });
          res.end();
        } else if(!post.password) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-password'
          });
          res.end();
        } else {
          config.users.loginEmail(post.email, post.password, function(err, user) {
            handleLoginCallback(err, user, req, res);
          });
        }
      }
    });
  };
};
