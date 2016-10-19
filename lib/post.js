
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:post');
var urlRewriter = require('./url-rewriter.js');

module.exports = function(config) {

  const reEmail = /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$/i;

  function activateSession(user, rememberMe, req, res, cb) {
    config.users.createSession(user.userId, function(err, sessionKey) {
      if(err) return cb(err);
      // Set cookie for account security for thirty days
      var thirtyDays = Math.floor(Date.now()/1000) + 2592000;
      var fourHours  = Math.floor(Date.now()/1000) + 14400;
      req.cookies.set('login.sec', config.users.hmac(user.userId, (rememberMe ? thirtyDays : fourHours), 'secure:'+sessionKey), {
        expires: (rememberMe ? thirtyDays : fourHours),
        maxAge: (rememberMe ? 2592000000 : 14400000),
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
      cb();
    });
  }

  function handleLoginCallback(err, user, rememberMe, redirectUrl, req, res) {
    if(err) {
      if(err === 'no-user') {
        if (redirectUrl && redirectUrl !== ''){
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=user-not-found&redirect='+redirectUrl
          });
        }
        else {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=user-not-found'
          });
        }
        res.end();
      }else if(err === 'user-locked') {
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=user-locked&redirect='+redirectUrl
        });
        res.end();
      } else {
        console.error(err);
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=error-occured&redirect='+redirectUrl
        });
        res.end();
      }
      return;
    }
    activateSession(user, rememberMe, req, res, function(err) {
      if(err) {
        console.error(err);
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=error-occured'
        });
        return res.end();
      }
      if (redirectUrl !== ''){
        var uri = url.parse(redirectUrl);
        var rewritten = 'http://';
        rewritten+= (uri.protocol === 'https:' ? 'h-t-t-p-s.' : 'h-t-t-p.');
        rewritten+= uri.hostname;
        rewritten+= (uri.port ? '.port-' + uri.port + '-port.' : '.');
        rewritten+= config.proxyServer.domain;
        rewritten+= uri.path + (uri.hash ? uri.hash : '');
        res.writeHead(302, {
          location: rewritten
        });
      }
      else {
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/'
        });
      }
      config.users.logLogin(req.headers, user, rememberMe, function(err, log){
        if(err) {
          console.error(err);
          return res.end();
        }
        res.end();
      });
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
            handleLoginCallback(err, user, (post.rememberMe ? true : false), post.redirectUrl, req, res);
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
            handleLoginCallback(err, user, (post.rememberMe ? true : false), post.redirectUrl, req, res);
          });
        }
      }
      else if(req.url === '/signup') {
        config.organizations.getAllFiltered(['organization_id'], function(err, organizations) {
          if(err) {
            console.error(err);
            res.writeHead(500, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
              message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
          }
          let valid = true;
          let errorFields = [];
          if(!post.organization) {
            errorFields.push('organisation');
            valid = false;
          } else {
            if(!organizations.some(function(organization) {
              return organization.organization_id === post.organization; // jshint ignore:line
            })) {
              errorFields.push('organisation');
              valid = false;
            }
          }
          if(!post.fname) {
            errorFields.push('förnamn');
            valid = false;
          }
          if(!post.lname) {
            errorFields.push('efternamn');
            valid = false;
          }
          if(!post.workplace) {
            errorFields.push('arbetsplats');
            valid = false;
          }
          if(!post.organizationFreetext && config.orgFreetext.indexOf(post.organization) !== -1) {
            errorFields.push('organisation (fritext)');
            valid = false;
          }
          if(!post.username) {
            errorFields.push('användarnamn');
            valid = false;
          } else {
            if(post.username.length < 5) {
              errorFields.push('användarnamn');
              valid = false;
            }
          }
          if(!post.email) {
            errorFields.push('jobbmejl');
            valid = false;
          } else {
            if(!reEmail.test(post.email)) {
              errorFields.push('jobbmejl');
              valid = false;
            }
          }
          if(post.emailP) {
            if(!reEmail.test(post.emailP)) {
              errorFields.push('privatmejl');
              valid = false;
            }
          }
          if(!post.password || !post.passwordV) {
            errorFields.push('lösenord');
            valid = false;
          }
          if(post.password !== post.passwordV) {
            errorFields.push('lösenord');
            valid = false;
          }
          if(!valid) {
            res.writeHead(400, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['invalid-input.pug']({
              errorFields: errorFields
            }));
          }

          post.locked         = 'true'; // Yes a string!
          post.admin          = false;
          post.organizationId = post.organization;
          post.pemail         = post.emailP;
          post.organization   = post.organizationFreetext;


          config.users.new(post, function(err) {
            if(err) {
              console.error(err);
              if(err === 'missing-input') {
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                res.end(config.pugGen.run['500.pug']({title: 'Kritiskt fel!',
                  message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
              }
              else if(err === 'conflicting-details') {
                res.writeHead(400, {
                  'content-type': 'text/html; charset=utf-8'
                });
                res.end(config.pugGen.run['invalid-input.pug']({
                  error: 'Användarnamn eller e-postadress var redan registrerad! Prova att återställa ditt konto!'
                }));
              } else {
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
                  message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
              }
              return;
            }
            config.emailer.newUserEmail(post.organizationId, function(err, info) {
              if(err) {
                console.error(err);
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                  message: 'Kunde inte skicka mail.'}));
              }
              res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8'
              });
              res.end(config.pugGen.run['signup-success.pug']());
            });
          });
        });
      }
      else if(req.url === '/remindMe') {
        config.organizations.getAllFiltered(['organization_id', 'organization_name'], function(err, organizations) {
          if(err) {
            console.error(err);
            res.writeHead(500, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
              message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
          }
          let valid = true;
          if(!post.organization && !post.email && !post.username) {
            valid = false;
          }
          if(!post.organization) {
            if(!post.email) {
              valid = false;
            } else {
              if(!reEmail.test(post.email)) {
                valid = false;
              }
            }
          } else {
            if(!organizations.some(function(organization) {
              return organization.organization_id === post.organization; // jshint ignore:line
            })) {
              valid = false;
            } else {
              if(!post.username) {
                valid = false;
              } else {
                if(post.username.length < 5) {
                  valid = false;
                }
              }
            }
          }

          if(!valid) {
            res.writeHead(400, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['remind-me.pug']({
              organizations: organizations,
              error: true
            }));
          }
          config.users.getDetails({
              email: (!post.organization ? post.email : null),
              organization: post.organization,
              username: post.username
            },
            function(err, user) {
              if(err) {
                console.error(err);
                if(err === 'no-user-found') {
                  res.writeHead(400, {
                    'content-type': 'text/html; charset=utf-8'
                  });
                  return res.end(config.pugGen.run['remind-me.pug']({error: 'Vi kunde inte hitta en användare med de uppgifterna, försök igen!'}));
                } else {
                  res.writeHead(500, {
                    'content-type': 'text/html; charset=utf-8'
                  });
                  return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                    message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
                }
              }
              config.emailer.dispatchResetPasswordLink(user, function(err, info) {
                if(err) {
                  console.error(err);
                  res.writeHead(500, {
                    'content-type': 'text/html; charset=utf-8'
                  });
                  return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                    message: 'Prova att gå tillbaka och fyll i formuläret igen.'}));
                }
                res.writeHead(200, {
                  'content-type': 'text/html; charset=utf-8'
                });
                return res.end(config.pugGen.run['remind-me-success.pug']());
              });
            }
          );
        });
      }
      else if(req.url === '/resetPassword') {
        debug('/resetPassword');
        if(!post.u) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/remindMe'
          });
          return res.end();
        }
        if(!post.password || !post.passwordV || post.password !== post.passwordV) {
          res.writeHead(400, {
            'content-type': 'text/html; charset=utf-8'
          });
          return res.end(config.pugGen.run['reset-password.pug']({key: post.u, error: 'Lösenordet var felaktigt!'}));
        }
        if(post.password.length < 8) {
          res.writeHead(400, {
            'content-type': 'text/html; charset=utf-8'
          });
          return res.end(config.pugGen.run['reset-password.pug']({key: post.u, error: 'Lösenordet var för kort!'}));
        }
        let info = config.emailer.validateHmacEmail(post.u);
        if(info === false) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/remindMe'
          });
          return res.end();
        }
        config.emailer.checkRecoveryKey(info.user, info.data, function(err) {
          if(err) {
            console.error(err);
            if(err === 'non-existant') {
              res.writeHead(302, {
                location: 'http://'+req.headers.host+'/remindMe'
              });
              return res.end();
            }
            res.writeHead(500, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
              message: 'Försök igen!'}));
          }
          config.users.changePassword(info.user, post.password, function(err) {
            if(err) {
              console.error(err);
              res.writeHead(500, {
                'content-type': 'text/html; charset=utf-8'
              });
              return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                message: 'Gå tillbaka och försök igen!'}));
            }
            config.mysql.getConnection(function(err, connection) {
              if(err) {
                console.error(err);
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                  message: 'Gå tillbaka och försök igen!'}));
              }
              connection.query('UPDATE recoveries '+
                'SET recovery_used = 1 '+
                'WHERE recovery_key = ?;', [info.data],
                function(err) {
                  if(err) {
                    console.error(err);
                    res.writeHead(500, {
                      'content-type': 'text/html; charset=utf-8'
                    });
                    return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
                      message: 'Gå tillbaka och försök igen!'}));
                  }
                  res.writeHead(200, {
                    'content-type': 'text/html; charset=utf-8'
                  });
                  return res.end(config.pugGen.run['reset-password-success.pug']());
                }
              );
            });
          });
        });
      }
      else if(req.url === '/admin/userData') {
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
                post.admin = parseInt(post.admin);
                if(post.admin !== user.admin) {
                  console.log('admin');
                  config.users.updateAdmin(user.id, post.admin, function(err) {
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
      } else if (req.url === '/admin/sendUserApprovedEmail') {
        config.emailer.userApprovedEmail(post.organization, post.email, post.pemail, function(err, info) {
          if(err) {
            console.error(err);
            res.writeHead(500, {
              'content-type': 'text/html; charset=utf-8'
            });
            return res.end(config.pugGen.run['500.pug']({title: 'Någonting gick fel!',
              message: 'Kunde inte skicka mail.'}));
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });
          return res.end('{"error": false}');
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
      } else if(req.url.indexOf('/browzine-login/') === 0) {
        config.users.loginUsername(post.organization, post.user, post.pass, function(err, user) {
          var urlQuery = req.url.substr('/browzine-login/'.length);
          if(err) {
            config.organizations.getBrowZineDetails(post.organization, true, function(mySqlErr, orgData) {
              if(mySqlErr) {
                console.error(mySqlErr);
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache, no-store, must-revalidate',
                  'expires': 0
                });
                return res.end(config.pugGen.run['500.pug']({title: 'An error occured with the database!', message: 'Try again later!'}));
              }
              if(err === 'no-user') {
                res.writeHead(400, {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache, no-store, must-revalidate',
                  'expires': 0
                });
                res.end(config.pugGen.run['browzine-login.pug']({orgData: orgData, url: urlQuery, error: 'Username or password is invalid!'}));
              } else if(err === 'user-locked') {
                res.writeHead(400, {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache, no-store, must-revalidate',
                  'expires': 0
                });
                res.end(config.pugGen.run['browzine-login.pug']({orgData: orgData, url: urlQuery, error: 'User is locked!'}));
              } else {
                console.error(err);
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache, no-store, must-revalidate',
                  'expires': 0
                });
                return res.end(config.pugGen.run['browzine-login.pug']({orgData: orgData, url: urlQuery, error: 'An unspecified error occured!'}));
              }
            });
            return;
          }
          activateSession(user, true, req, res, function(err) {
            if(err) {
              console.error(err);
              config.organizations.getBrowZineDetails(post.organization, true, function(mySqlErr, orgData) {
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-cache, no-store, must-revalidate',
                  'expires': 0
                });
                if(mySqlErr) {
                  console.error(mySqlErr);
                  return res.end(config.pugGen.run['500.pug']({title: 'An error occured with the database!', message: 'Try again later!'}));
                }
                return res.end(config.pugGen.run['browzine-login.pug']({orgData: orgData, url: urlQuery, error: 'An unspecified error occured!'}));
              });
              return;
            }
            if(urlQuery) {
              res.writeHead(302, {
                'location': urlRewriter(url.parse(urlQuery), null, config),
                'content-type': 'text/plain; charset=utf-8',
                'cache-control': 'no-cache, no-store, must-revalidate',
                'expires': 0
              });
            } else {
              res.writeHead(200, {
                'content-type': 'text/plain; charset=utf-8',
                'cache-control': 'no-cache, no-store, must-revalidate',
                'expires': 0
              });
            }
            res.end('success');
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
