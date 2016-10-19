/*
 Makes requests to pubmed contain the otool query so that the organization is detected.
*/

'use strict';

var debug = require('debug')('proxive:otool');

var url   = require('url');

module.exports = function(config) {

  debug('otool setup!');

  let otools = {};

  function updateOtool() {
    config.mysql.getConnection(function(err, connection) {
      if(err) throw err;
      connection.query('SELECT organization_id AS id, organization_pubmed_otool AS otool FROM organizations;', function(err, rows) {
        connection.release();
        if(err) return console.error(err);
        for(let i = 0, ii = rows.length; i < ii; i++) {
          otools[rows[i].id] = rows[i].otool;
        }
      });
    });
  }

  updateOtool();

  setInterval(updateOtool, 60000);

  function otooling(data) {

    let uri = url.parse(data.url);

    if(uri.hostname === 'www.ncbi.nlm.nih.gov') {
      if(otools[data.clientRequest.organizationId]) {
        debug('Attaching otool '+otools[data.clientRequest.organizationId]+' to query!');
        uri.search = (uri.query ? uri.query + '&otool=' : '?otool=') + otools[data.clientRequest.organizationId];
      }
      data.url = url.format(uri);
    }
  }
  return otooling;
};
