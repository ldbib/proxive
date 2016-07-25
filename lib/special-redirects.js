
/*
 This file handles special redirect cases.
*/

'use strict';

var debug = require('debug')('proxive:special-redirects');

var url   = require('url');

var urlRewriter = require('./url-rewriter.js');

module.exports = function(config) {

  debug('Special redirect setup!');

  for (var i = config.specialRedirects.length - 1; i >= 0; i--) {
    config.specialRedirects[i] = [url.parse(config.specialRedirects[i][0]), url.parse(config.specialRedirects[i][1])];
  }

  const cases = new Map(config.specialRedirects);

  function specialRedirects(data) {

    var uri = url.parse(data.url);

    cases.forEach(function(value, key) {
      if(uri.hostname === key.hostname && uri.pathname === key.pathname) {
        if(data.clientResponse.writeHead) { // http
          data.clientResponse.writeHead(301, {'Location': urlRewriter(value, data, config)});
        } else if(data.clientResponse.set) { // express
          data.clientResponse.status(301).set({'Location': urlRewriter(value, data, config)});
        }
        debug('Redirecting "' + key.href + '" to "' + value.href + '", the URL is "' + urlRewriter(value, data, config) + '"');
        return data.clientResponse.end();
      }
    });
  }
  return specialRedirects;
};
