
'use strict';

var qs    = require('querystring');
var url   = require('url');
var debug = require('debug')('proxive:delete');

module.exports = function(config) {

  return function(req, res) {
    var body = '';

    req.on('data', function (data) {
      body += data;
      // Too much DELETE data, kill the connection!
      // 1e6 === 1 * Math.pow(10, 6) === 1 * 1000000 ~~~ 1MB
      if (body.length > 1e6) {
        req.connection.destroy();
      }
    });

    req.on('end', function () {
      var post = qs.parse(body);
      if  (req.url === '/admin/deleteWhiteList') {
        debug('/admin/settings/deleteWhiteList');
        if(!post.id) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-id'
          });
          res.end();
        } 
        else {
          // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
          config.users.validateAdmin(req, res, true, function(userInfo) {
            config.organizations.deleteWhiteListUrls(post.id, function(err, rows) {
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
              res.end(JSON.stringify({'error': false, rows: rows}));
            });  
          });
        }
      }
      else if  (req.url === '/admin/deleteUser') {
        debug('/admin/settings/deleteUser');
        if(!post.id) {
          res.writeHead(302, {
            location: 'http://'+req.headers.host+'/?err=missing-id'
          });
          res.end();
        } 
        else {
          // We pass true as the third parameter to ensure that the response will be in json if the user isn't authenticated
          config.users.validateAdmin(req, res, true, function(userInfo) {
            config.users.removeUser(post.id, function(err, rows) {
              if(err) {
                console.error(err);
                if(err === 'invalid-input') {
                  res.writeHead(400, {'content-type': 'application/json; charset=utf-8'});
                  return res.end('{"error": "Id invalid!"}');
                }
                res.writeHead(500, {'content-type': 'application/json; charset=utf-8'});
                return res.end('{"error": "Something went wrong!"}');
              }
              res.writeHead(200, {
                'content-type': 'application/json; charset=utf-8',
                'cache-control': 'no-cache, no-store, must-revalidate',
                'expires': 0
              });
              res.end(JSON.stringify({'error': false, rows: rows}));
            });  
          });
        }
      }
      else {
        res.writeHead(404, {
          'content-type': 'text/html; charset=utf-8'
        });
        res.end(config.pugGen.run['404.pug']({title: 'Sidan hittades inte!', message: 'Resursen kunde inte hittas!'}));
      }
    });
  };
};
