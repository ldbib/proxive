
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:get');

module.exports = function(config) {

  const reAbsUrl = /("|'|=|url\(\s*|url=| )(https?:)\/\/((?:[A-Z0-9-]{1,63}\.){1,125}[A-Z]{2,63})/ig;

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
    if(path === '/opensource') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['opensource.pug']());
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
      config.users.validateSignin(req, res, function(userData) {
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
              res.writeHead(200, {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'no-cache, no-store, must-revalidate',
                'expires': 0
              });
              res.end(config.pugGen.run['home.pug']({
                organization: organization,
                currentUser: userData,
                nextUrl: 'http://h-t-t-p' + (directUri.protocol === 'https:' ? '-s.' : '.') +
                  directUri.hostname + (directUri.port ? '.port-' + directUri.port + '-port.' : '.') +
                  config.proxyServer.domain + directUri.pathname +(directUri.search ? directUri.search : '')
              }));
              return;
            }
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'expires': 0
          });
          organization.homepageHtml = organization.homepageHtml.replace(reAbsUrl, function(match, r1, r2, r3) {
            return r1 + 'http://' + (r2 === 'http:' ? 'h-t-t-p.' : 'h-t-t-p-s.') + r3 + '.' + config.domain;
          });
          res.end(config.pugGen.run['home.pug']({organization: organization, currentUser: userData}));
        });
      });
    }
    else if(path === '/admin' || path === '/admin/') {
      debug('/admin');
      config.users.validateAdmin(req, res, function(userData) {
        config.organizations.getLimitedFromUser(userData.id, function(err, organization) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
            return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av organisationsuppgifterna!',
              message: 'Prova att ladda om sidan om en liten stund.'}));
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'expires': 0
          });
          res.end(config.pugGen.run['admin.pug']({organization: organization, currentUser: userData}));
        });
      });
    }
    else if(path === '/admin/users' || path === '/admin/users/') {
      debug('/admin/users');
      config.users.validateAdmin(req, res, function(userData) {
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
              'content-type': 'text/html; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(config.pugGen.run['admin-users.pug']({users: users, currentUser: userData, organizations: organizations}));
          });
        });
      });
    }
    else if(path === '/admin/userData' || path === '/admin/userData/') {
      debug('/admin/userData');
      config.users.validateAdmin(req, res, function() {
        config.users.getDetails(parseInt(query.id, 10), function(err, user) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
            return res.end('{"error": "Something went wrong!"}');
          }
          res.writeHead(200, {
            'content-type': 'application/json; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'expires': 0
          });
          res.end(JSON.stringify(user));
        });
      });
    }
    else if(path === '/admin/settings' || path === '/admin/settings/') {
      debug('/admin/settings');
      config.users.validateAdmin(req, res, function(userData) {
        config.organizations.getFromUser(userData.id, function(err, orgData) {
          if(err) {
            console.error(err);
            res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
            return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid hämtningen av användarna!',
              message: 'Prova att ladda om sidan om en liten stund.'}));
          }
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-cache, no-store, must-revalidate',
            'expires': 0
          });
          res.end(config.pugGen.run['admin-settings.pug']({organization: orgData}));
        });
      });
    }
    else if(path === '/admin/wiuSearchBlock') {
      // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
      config.users.validateAdmin(req, res, true, function(userInfo) {
        if(userInfo.organizationId !== query.id) {
          res.writeHead(403, {'content-type': 'application/json; charset=utf-8'});
          return res.end('{"error": "You can\'t edit that organization!"}');
        }
        if(query.url === '' || query.url === '.') {
          config.organizations.getWiuUrls(query.id, function(err, urls) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(JSON.stringify({'error': false, urls: urls}));
          });
        } else {
          config.organizations.searchWiuUrls(query.url, query.id, function(err, urls) {
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
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(JSON.stringify({'error': false, urls: urls}));
          });
        }
      });
    }
    else if(path === '/admin/searchWhiteList') {
      // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
      config.users.validateAdmin(req, res, true, function(userInfo) {
        if(query.url === '' || query.url === '.') {
          config.organizations.getWhiteListUrls(function(err, urls) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(JSON.stringify({'error': false, urls: urls}));
          });
        } else {
          config.organizations.searchWhiteListUrls(query.url, function(err, urls) {
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
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(JSON.stringify({'error': false, urls: urls}));
          });
        }
      });
    }
    else if(path === '/admin/logging' || path === '/admin/logging/') {
      debug('/admin/logging');
      config.users.validateAdmin(req, res, function(userData) {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'expires': 0
        });
        res.end(config.pugGen.run['admin-logging.pug']());
      });
    }
    else if(path === '/admin/logs') {
      // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
      config.users.validateAdmin(req, res, true, function(userInfo) {
        if(query.search === '' || query.search === '.') {
          res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
          return res.end('{"error": "Invalid input!"}');
        } else {
          config.organizations.searchLogs(userInfo.organizationId, query.search, function(err, logs) {
            if(err) {
              console.error(err);
              res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
              return res.end('{"error": "Something went wrong!"}');
            }
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-cache, no-store, must-revalidate',
              'expires': 0
            });
            res.end(JSON.stringify({'error': false, logs: logs}));
          });
        }
      });
    }
    else if(path.indexOf('/browzine-login/') === 0) {
      config.organizations.getBrowZineDetails(req.headers.host, function(err, orgData) {
        var urlQuery = req.url.substr('/browzine-login/'.length);
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache, no-store, must-revalidate',
          'expires': 0
        });
        res.end(config.pugGen.run['browzine-login.pug']({orgData: orgData, url: urlQuery}));
      });
    } else {
      res.writeHead(404, {
        'content-type': 'text/html; charset=utf-8'
      });
      res.end(config.pugGen.run['404.pug']({title: 'Sidan hittades inte!', message: 'Resursen kunde inte hittas!'}));
    }
  };
};
