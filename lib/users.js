
'use strict';

var crypto = require('crypto');

var randomstring = require("randomstring");

function users(config) {

  /*
    The implementation of the hmacUser is inspired by the article 'A Secure Cookie Protocol' by
    Alex X. Liu, Jason M. Kovacs, Chin-Tser Huang, Mohamed G. Gouda

    The part missing is the TLS session part which means that the cookie could be hijacked.
  */

  function hmacUser(userid, expiry, garbage) {
    garbage = (garbage || randomstring(16));
    var dynamicKey = crypto.createHmac('sha512', config.serverPrivateKey).update(userid+'|'+expiry).digest('hex');
    var encrypted = crypto.createHmac('sha512', dynamicKey).update(userid+'|'+expiry+'|'+garbage).digest('hex');
    var finalOutput = userid+'|'+expiry+'|'+garbage+'|'+encrypted;
    return finalOutput;
  }

  function validateHmacUser(hmac) {
    if(!hmac) {
      return false;
    }
    var parts = hmac.split('|');
    if(parts[1] <= Math.floor(Date.now()/1000)) {
      return false;
    }
    var dynamicKey = crypto.createHmac('sha512', config.serverPrivateKey).update(parts[0]+'|'+parts[1]).digest('hex');
    var encrypted = crypto.createHmac('sha512', dynamicKey).update(parts[0]+'|'+parts[1]+'|'+parts[2]).digest('hex');
    var finalOutput = parts[0]+'|'+parts[1]+'|'+parts[2]+'|'+encrypted;
    if(hmac === finalOutput) {
      return parts[0];
    }
    return false;
  }

  function getAll(cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT * FROM users;', function(err, rows) {
        connection.release();
        cb(err, rows);
      });
    });
  }
  function getUserDetails(userDetails, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      function returnFromMySQL(err, rows) {
        connection.release();
        cb(err, rows);
      }
      if(userDetails.email) {
        connection.query('SELECT * FROM users WHERE user_email = '+connection.escape(userDetails.email)+
          ' OR user_pemail = '+connection.escape(userDetails.email)+';', returnFromMySQL);
      } else {
        connection.query('SELECT * FROM users WHERE user_organization_id = '+connection.escape(userDetails.organization)+
          ' AND user_username = '+connection.escape(userDetails.username)+';', returnFromMySQL);
      }
    });
  }

  function user() {
    return true;
  }

  user.getAll         = getAll;
  user.hmac           = hmacUser;
  user.validateHmac   = validateHmacUser;
  user.getUserDetails = getUserDetails;

  return user;
}

module.exports = users;