
'use strict';

const url = require('url');
const debug = require('debug')('unblocker:logging');
const UA = require('ua-parser');

module.exports = function( config ) {

  function logging(data) {
    debug('logging '+data.url);

    let unix = Math.floor(Date.now() / 1000);
    let u = data.clientRequest.headers['user-agent'];
    let message;

    let uri = url.parse(data.url);

    let ct = data.headers['content-type'];

    if(ct) {
      if(ct.indexOf(';') !== -1) {
        ct = ct.substring(0, ct.indexOf(';'));
      }
    }

    if(['application/pdf', 'application/x-pdf', 'application/x-bzpdf', 'application/x-gzpdf'].indexOf(ct)!== -1) {
      message = 'Laddade ner pdf från: '+uri.hostname;
    }

    if(ct === 'text/html') {
      if((data.clientRequest.headers['X-Requested-With'] &&
        data.clientRequest.headers['X-Requested-With'].toLowerCase() === 'xmlhttprequest') ||
        (data.clientRequest.headers['x-requested-with'] &&
        data.clientRequest.headers['x-requested-with'].toLowerCase() === 'xmlhttprequest')) {
        // HTML loaded with AJAX
      } else {
        message = 'Laddade: '+uri.host;
      }
    }

    if(message) {
      config.mysql.getConnection(function(err, connection) {
        if(err) console.error(err);
        connection.query('INSERT INTO logs '+
          '(log_user_id, '+
          'log_message, '+
          'log_unix, '+
          'log_ip, '+
          'log_os, '+
          'log_ua, '+
          'log_device) '+
          'VALUES '+
          '(?, ?, ?, ?, ?, ?, ?);',
          [
            data.clientRequest.userId,
            message,
            unix,
            data.clientRequest.headers['x-forwarded-for'],
            UA.parseOS(u).toString(),
            UA.parseUA(u).toString(),
            UA.parseDevice(u).toString()
          ], function(err) {
            connection.release();
            if(err) console.error(err);
          }
        );
      });
    }
  }
  return logging;
};
