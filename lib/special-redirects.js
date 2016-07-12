
/*
 This file handles special redirect cases.
*/

'use strict';

var debug = require('debug')('proxive:special-redirects');

var url   = require('url');

var urlRewriter = require('./url-rewriter.js');

module.exports = function(config) {

  debug('Special redirect setup!');

  const cases = new Map([
    [url.parse('https://www.ncbi.nlm.nih.gov/account/'), url.parse('https://www.ncbi.nlm.nih.gov/account/signin/')]
  ]);

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
