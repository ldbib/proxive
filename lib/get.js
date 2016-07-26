
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
  return function(req, res) {
    var path = url.parse(req.url).pathname;
    if(path === '/redirect' || path === '/redirect/') {
      debug('/redirect');
      var query = qs.parse(req.url.substring('/redirect'.length + 1));
      if(query.url.indexOf('http') === 0) {
        var uri = url.parse(query.url);
        res.writeHead(302, {
          location: 'http://h-t-t-p' + (uri.protocol === 'https:' ? '-s.' : '.') +
            uri.hostname + (uri.port ? '.port-' + uri.port + '-port.' : '.') + req.headers.host + uri.pathname +
            (uri.search ? uri.search : '')
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
            var uri = url.parse(organization.directUrl);
            // We don't want to redirect if the hostname isn't avaliable
            if(uri.hostname) {
              res.writeHead(302, {
                location: 'http://h-t-t-p' + (uri.protocol === 'https:' ? '-s.' : '.') +
                  uri.hostname + (uri.port ? '.port-' + uri.port + '-port.' : '.') + config.proxyServer.domain + uri.pathname +
                  (uri.search ? uri.search : '')
              });
              return res.end();
            }
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });
          res.end(config.pugGen.run['home.pug']({organization: organization, user: userData}));
        });
      });
    }
    else if(path === '/admin' || path === '/admin/') {
      debug('/admin');
      validateSignin(req, res, function(userData) {
        if(userData.admin > 0) {
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
            res.end(config.pugGen.run['admin.pug']({organization: organization, user: userData}));
          });
        } else {
          // Not admin so redirect to /
          res.writeHead(302, {
            location: (config.https ? 'https://' : 'http://') + config.loginServer.domain
          });
          res.end();
        }
      });
    } else {
      res.writeHead(404, {
        'content-type': 'text/html; charset=utf-8'
      });
      res.end(config.pugGen.run['404.pug']({title: 'Sidan hittades inte!', message: 'Resursen kunde inte hittas!'}));
    }
  };
};
