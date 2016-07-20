
'use strict';

var crypto  = require('crypto');
var debug   = require('debug')('proxive:users');

var randomstring = require('randomstring').generate;

function users(config) {

  /*
    The implementation of the hmacUser is inspired by the article 'A Secure Cookie Protocol' by
    Alex X. Liu, Jason M. Kovacs, Chin-Tser Huang, Mohamed G. Gouda

    The part missing is the TLS session part which means that the cookie could be hijacked.
  */

  function hmacUser(userid, expiry, data) {
    data = (data ? data : randomstring(16));
    var dynamicKey = crypto.createHmac('sha512', config.serverPrivateKey).update(userid+'|'+expiry).digest('hex');
    var encrypted = crypto.createHmac('sha512', dynamicKey).update(userid+'|'+expiry+'|'+data).digest('hex');
    var finalOutput = userid+'|'+expiry+'|'+data+'|'+encrypted;
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
      return {user: parts[0], data: parts[2]};
    }
    return false;
  }

  function loginUsername(organization, username, password, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      debug('SELECT user_id AS userId, user_password AS userPassword, '+
        'user_locked AS userLocked, user_agreement AS userAgreement '+
        'FROM users WHERE user_organization_id = '+connection.escape(organization)+
        ' AND user_username = '+connection.escape(username)+';');
      connection.query('SELECT user_id AS userId, user_password AS userPassword, '+
        'user_locked AS userLocked, user_agreement AS userAgreement '+
        'FROM users WHERE user_organization_id = '+connection.escape(organization)+
        ' AND user_username = '+connection.escape(username)+';', function(err, rows) {
        connection.release();
        if(err) {
          return cb(err, null);
        }
        debug('loginUsername: Username: '+username+' Organization: '+organization);
        if(rows.length === 0) {
          setTimeout(function() {
            cb('no-user', null);
          }, 100);
          return;
        }
        if(!validatePassword(password, rows[0].userPassword)) {
          return cb('no-user', null);
        }
        delete rows[0].userPassword; // Unnessecary to pass back userPassword
        cb(null, rows[0]);
      });
    });
  }
  function loginEmail(email, password, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      debug('SELECT user_id AS userId, user_password AS userPassword, '+
        'user_locked AS userLocked, user_agreement AS userAgreement '+
        'FROM users WHERE user_email = '+connection.escape(email)+
        ' OR user_pemail = '+connection.escape(email)+';');
      connection.query('SELECT user_id AS userId, user_password AS userPassword, '+
        'user_locked AS userLocked, user_agreement AS userAgreement '+
        'FROM users WHERE user_email = '+connection.escape(email)+
        ' OR user_pemail = '+connection.escape(email)+';', function(err, rows) {
        connection.release();
        if(err) {
          return cb(err, null);
        }
        debug('loginEmail: Email: '+email);
        if(rows.length === 0) {
          setTimeout(function() {
            cb('no-user', null);
          }, 100);
          return;
        }
        if(!validatePassword(password, rows[0].userPassword)) {
          return cb('no-user', null);
        }
        delete rows[0].userPassword; // Unnessecary to pass back userPassword
        cb(null, rows[0]);
      });
    });
  }

  function validatePassword(plainPass, hashedPass) {
    var salt, validHash, calculatedHash;
    if((typeof hashedPass !== 'string') || (typeof plainPass !== 'string')) {
      return false;
    }
    if(hashedPass.length <= 32 || plainPass.length < 6) {
      return false;
    }
    if(hashedPass.length === 42) {
      salt = hashedPass.substr(0, 10);
      validHash = salt + md5(plainPass + salt);
    } else {
      salt = hashedPass.substr(0, 32);
      calculatedHash = sha512(plainPass + salt + config.publicSalt);
      for(var i = 0; i < 16384; i++) {
        calculatedHash = sha512(calculatedHash + salt + config.publicSalt);
      }
      validHash = salt + calculatedHash;
    }

    debug('validatePassword: '+((hashedPass === validHash) ? 'true' : 'false'));

    return (hashedPass === validHash);
  }

  function md5(str) {
    return crypto.createHash("md5").update(str).digest("hex");
  }

  function sha512(str) {
    return crypto.createHash("sha512").update(str).digest("hex");
  }

  function getAll(cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT * FROM users;', function(err, rows) {
        connection.release();
        debug('getAll: Users fetched: '+rows.length);
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

  user.getAll           = getAll;
  user.hmac             = hmacUser;
  user.validateHmac     = validateHmacUser;
  user.getUserDetails   = getUserDetails;
  user.loginUsername    = loginUsername;
  user.loginEmail       = loginEmail;
  user.validatePassword = validatePassword; // For testing

  return user;
}

module.exports = users;