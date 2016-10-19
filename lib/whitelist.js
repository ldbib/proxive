/*
 Whitelist
*/

'use strict';

var debug = require('debug')('proxive:whitelist');

var url   = require('url');

var tld   = require('tld');

module.exports = function(config) {

  debug('whitelist setup!');

  let whitelist = [];

  function updateWhitelist() {
    debug('whitelist loading!');
    config.mysql.getConnection(function(err, connection) {
      if(err) throw err;
      connection.query('SELECT whitelist_url AS url FROM whitelists;', function(err, rows) {
        let tempWhitelist = [];
        connection.release();
        if(err) return console.error(err);
        for(let i = 0, ii = rows.length; i < ii; i++) {
          tempWhitelist.push(tld.registered(rows[i].url));
        }
        whitelist = tempWhitelist;
        debug('whitelist ready!');
      });
    });
  }

  updateWhitelist();

  setInterval(updateWhitelist, 60000);

  function checkWhitelist(data) {

    let uri = url.parse(data.url);
    console.log('host', tld.registered(uri.hostname));
    if(whitelist.indexOf(tld.registered(uri.hostname)) === -1) {
      //Also check if domain is in whitelist but not subdomain
      var checkUrl = tld.registered(uri.hostname).split('.');
      checkUrl = tld.registered(uri.hostname).replace(checkUrl[0] + '.', '');
      if (whitelist.indexOf(checkUrl) === -1){
        data.clientResponse.writeHead(403, {
          'content-type': 'text/html; charset=utf-8'
        });
        return data.clientResponse.end(config.pugGen.run['blocked-url.pug']({url: data.url, email: config.webmasterEmail}));
      }
    }
  }
  return checkWhitelist;
};
