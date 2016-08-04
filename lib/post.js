
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
      var thirtyDays = Math.floor(Date.now()/1000) + 2592000;
      var fourHours  = Math.floor(Date.now()/1000) + 14400;
      req.cookies.set('login.sec', config.users.hmac(user.userId, thirtyDays, 'secure:'+sessionKey), {
        expires: thirtyDays,
        maxAge: 2592000000,
        domain: '.' + req.headers.host,
        httpOnly: true,
        secure: config.https
      });
      // Set cookie for browsing for 4 hours
      req.cookies.set('login', config.users.hmac(user.userId, fourHours, sessionKey), {
        expires: fourHours,
        maxAge: 14400000,
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
      } else if(req.url === '/admin/userData') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(post.id === 'new') {
            config.users.new(post, function(err) {
              if(err) {
                console.error(err);
                if(err === 'missing-input' || err === 'invalid-email') {
                  res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                  return res.end('{"error": "Invalid inputs!"}');
                }
                if(err === 'conflicting-details') {
                  res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                  return res.end('{"error": "Other user has same info!"}');
                }
                res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Something went wrong!"}');
              }
              res.writeHead(200, {
                'content-type': 'application/json; charset=utf-8'
              });
              res.end('{"error": false}');
            });
          } else {
            post.id = parseInt(post.id, 10);
            config.users.getDetails(post.id, function(err, user) {
              if(err) {
                console.error(err);
                if(err === 'no-user-found') {
                  res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                  return res.end('{"error": "User is gone!"}');
                }
                res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Something went wrong!"}');
              }
              // Admins shouldn't be able to change a higher admin
              if(userInfo.admin < user.admin) {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Permissions too low!"}');
              }
              config.users.save(post, function(err) {
                if(err) {
                  console.error(err);
                  if(err === 'missing-input' || err === 'invalid-email') {
                    res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                    return res.end('{"error": "Invalid inputs!"}');
                  }
                  if(err === 'conflicting-details') {
                    res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                    return res.end('{"error": "Other user has same info!"}');
                  }
                  res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
                  return res.end('{"error": "Something went wrong!"}');
                }
                if((post.admin ? 1 : 0) !== user.admin) {
                  config.users.updateAdmin(user.id, (post.admin ? 1 : 0), function(err) {
                    if(err) {
                      console.error(err);
                      res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
                      return res.end('{"error": "Something went wrong!"}');
                    }
                    res.writeHead(200, {
                      'content-type': 'application/json; charset=utf-8'
                    });
                    res.end('{"error": false}');
                  });
                  return;
                }
                res.writeHead(200, {
                  'content-type': 'application/json; charset=utf-8'
                });
                res.end('{"error": false}');
              });
            });
          }
        });
      } else if(req.url === '/admin/emailSettings') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(userInfo.organizationId !== post.id) {
            res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "You can\'t edit that organization!"}');
          }
          config.organizations.saveEmailSettings(post, function(err) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false}');
          });
        });
      } else if(req.url === '/admin/organizationSettings') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(userInfo.organizationId !== post.id) {
            res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "You can\'t edit that organization!"}');
          }
          config.organizations.saveSettings(post, function(err) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false}');
          });
        });
      } else if(req.url === '/admin/wiuSettings') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(userInfo.organizationId !== post.id) {
            res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "You can\'t edit that organization!"}');
          }
          config.organizations.saveWiuSettings(post, function(err) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false}');
          });
        });
      } else if(req.url === '/admin/wiuAddBlock') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(userInfo.organizationId !== post.id) {
            res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "You can\'t edit that organization!"}');
          }
          config.organizations.wiuBlockUrl(post, function(err, domain) {
            if(err) {
              console.error(err);
              if(err === 'invalid-input') {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Url invalid!"}');
              }
              if(err === 'url-exist') {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Url exists already!"}');
              }
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false, "domain": "'+domain+'"}');
          });
        });
      } else if(req.url === '/admin/addWhiteList') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function() {
          config.organizations.addWhiteList(post.url, function(err, domain) {
            if(err) {
              console.error(err);
              if(err === 'invalid-input') {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Url invalid!"}');
              }
              if(err === 'url-exist') {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Url exists already!"}');
              }
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false, "domain": "'+domain+'"}');
          });
        });
      } else if(req.url === '/admin/homepageSettings') {
        // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
        config.users.validateAdmin(req, res, true, function(userInfo) {
          if(userInfo.organizationId !== post.id) {
            res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "You can\'t edit that organization!"}');
          }
          config.organizations.saveHomepageSettings(post, function(err) {
            if(err) {
              console.error(err);
              if(err === 'invalid-input') {
                res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Url invalid!"}');
              }
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8'
            });
            res.end('{"error": false}');
          });
        });
      } else {
        res.writeHead(404, {
          'content-type': 'application/json; charset=utf-8'
        });
        res.end('{"error": 404}');
      }
    });
  };
};
