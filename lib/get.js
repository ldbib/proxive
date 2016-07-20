
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:get');

module.exports = function(config) {
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
      if(req.cookies.get('login.sec') && req.cookies.get('login')) {
        var user = config.users.validateHmac(req.cookies.get('login.sec'));
        if(user && config.users.validateHmac(req.cookies.get('login'))) {
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8'
          });
          return res.end(config.pugGen.run['home.pug']());
        }
      }
      config.organizations.getAllFiltered(['organization_id', 'organization_name'], function(err, organizations) {
        if(err) {
          console.error(err);
          res.writeHead(500, {
            'content-type': 'text/html; charset=utf-8'
          });
          return res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
            message: ''}));
        }
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8'
        });
        return res.end(config.pugGen.run['login.pug']({organizations: organizations}));
      });
      return;
    }
    res.writeHead(404, {
      'content-type': 'text/html; charset=utf-8'
    });
    return res.end(config.pugGen.run['404.pug']({title: 'Sidan hittades inte!', message: 'Resursen kunde inte hittas!'}));
  };
};
