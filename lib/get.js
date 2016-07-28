
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:get');

module.exports = function(config) {
  function renderLogin(req, res) {
    config.organizations.getAllFiltered(['organization_id', 'organization_name'], function(err, organizations) {
      if(err) {
        console.error(err);
        res.writeHead(500, {
          'content-type': 'text/html; charset=utf-8'
        });
        return res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
          message: ''}));
      }
      var redirect = null;
      var parsedQuery = '';
      if(req.url.indexOf('?') !== -1) {
        parsedQuery = qs.parse(req.url.substring(req.url.indexOf('?')+1));
        if(parsedQuery.redirect) {
          redirect = parsedQuery.redirect;
        }
      }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['login.pug']({organizations: organizations, redirect: redirect}));
    });
  }
  function validateSignin(req, res, cb) {
    if(req.cookies.get('login.sec') && req.cookies.get('login')) {
      var cookieInfo = config.users.validateHmac(req.cookies.get('login.sec'));
      if(typeof cookieInfo === 'object' && cookieInfo.data.indexOf('secure:') === 0) {
        config.users.validateSession(cookieInfo.user, cookieInfo.data.replace('secure:', ''), function(err) {
          if(err) {
            console.error(err);
            if(err === 'invalid-user' || err === 'no-user') {
              config.users.clearLoginCookies(req);
              res.writeHead(302, {
                location: (config.https ? 'https://' : 'http://') + config.loginServer.domain
              });
              return res.end();
            } else {
              res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
              return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid valideringen av inloggningsuppgifterna!',
                message: 'Prova att ladda om sidan om en liten stund.'}));
            }
          }
          debug('user: '+ cookieInfo.user);
          config.users.getDetails(parseInt(cookieInfo.user, 10), function(err, userData) {
            if(err) {
              console.error(err);
              if(err === 'no-user-found') {
                config.users.clearLoginCookies(req);
                return renderLogin(req, res);
              } else {
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                return res.end(config.pugGen.run['500.pug']({title: 'Något gick fel!',
                  message: 'Försök igen!'})); // TODO better error message
              }
            }
            cb(userData);
          });
        });
      }
    } else {
      renderLogin(req, res);
    }
  }
  function validateAdmin(req, res, cb) {
    validateSignin(req, res, function(userData) {
      if(userData.admin > 0) {
        cb(userData);
      } else {
        // Not admin so redirect to /
        res.writeHead(302, {
          location: (config.https ? 'https://' : 'http://') + config.loginServer.domain
        });
        res.end();
      }
    });
  }

  return function(req, res) {
    var uri   = url.parse(req.url);
    var path  = uri.pathname;
    var query = qs.parse(uri.query);
    if(path === '/redirect' || path === '/redirect/') {
      debug('/redirect');
      if(query.url.indexOf('http') === 0) {
        var redirectUri = url.parse(query.url);
        res.writeHead(302, {
          location: 'http://h-t-t-p' + (redirectUri.protocol === 'https:' ? '-s.' : '.') +
            redirectUri.hostname + (redirectUri.port ? '.port-' + redirectUri.port + '-port.' : '.') +
            req.headers.host + redirectUri.pathname + (redirectUri.search ? redirectUri.search : '')
        });
      } else {
        res.writeHead(302, {
          location: 'http://'+req.headers.host+'/?err=invalid-url'
        });
      }
      return res.end();
    }
    if(path === '/integrity') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['integrity.pug']());
    }
    if(path === '/personal-details') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['personal-details.pug']());
    }
    if(path === '/cookies') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['cookies.pug']());
    }
    if(path === '/' || path === '') {
      debug('/');
      validateSignin(req, res, function(userData) {
        config.organizations.getLimitedFromUser(userData.id, function(err, organization) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
            return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av organisationsuppgifterna!',
              message: 'Prova att ladda om sidan om en liten stund.'}));
          }
          // If the organization has set the direct url parameter and the url is set, redirect the user.
          if(organization.directToUrl === 1 && organization.directUrl) {
            var directUri = url.parse(organization.directUrl);
            // We don't want to redirect if the hostname isn't avaliable
            if(directUri.hostname) {
              res.writeHead(302, {
                location: 'http://h-t-t-p' + (directUri.protocol === 'https:' ? '-s.' : '.') +
                  directUri.hostname + (directUri.port ? '.port-' + directUri.port + '-port.' : '.') +
                  config.proxyServer.domain + directUri.pathname +(directUri.search ? directUri.search : '')
              });
              return res.end();
            }
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });
          res.end(config.pugGen.run['home.pug']({organization: organization, currentUser: userData}));
        });
      });
    }
    else if(path === '/admin' || path === '/admin/') {
      debug('/admin');
      validateAdmin(req, res, function(userData) {
        config.organizations.getLimitedFromUser(userData.id, function(err, organization) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
            return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av organisationsuppgifterna!',
              message: 'Prova att ladda om sidan om en liten stund.'}));
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });
          res.end(config.pugGen.run['admin.pug']({organization: organization, currentUser: userData}));
        });
      });
    }
    else if(path === '/admin/users' || path === '/admin/users/') {
      debug('/admin/users');
      validateAdmin(req, res, function(userData) {
        config.users.getUsersFromOrg(userData.organizationId, function(err, users) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
            return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av användarna!',
              message: 'Prova att ladda om sidan om en liten stund.'}));
          }
          config.organizations.getAllFiltered(['organization_id', 'organization_name'], function(err, organizations) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
              return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av användarna!',
                message: 'Prova att ladda om sidan om en liten stund.'}));
            }
            res.writeHead(200, {
              'content-type': 'text/html; charset=utf-8'
            });
            res.end(config.pugGen.run['admin-users.pug']({users: users, currentUser: userData, organizations: organizations}));
          });
        });
      });
    }
    else if(path === '/admin/userData' || path === '/admin/userData/') {
      debug('/admin/userData');
      validateAdmin(req, res, function() {
        config.users.getDetails(parseInt(query.id, 10), function(err, user) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{error: "Something went wrong!"}');
          }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8'
          });
          res.end(JSON.stringify(user));
        });
      });
    } else {
      res.writeHead(404, {
        'content-type': 'text/html; charset=utf-8'
      });
      res.end(config.pugGen.run['404.pug']({title: 'Sidan hittades inte!', message: 'Resursen kunde inte hittas!'}));
    }
  };
};
