
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

  function createSession(userId, cb) {
    debug('createSession: userId: '+userId);
    if(typeof userId !== 'string' && typeof userId !== 'number')
      return cb('invalid-input');
    var sessionKey = randomstring(32);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('INSERT INTO sessions(session_user_id, session_created, session_user_cookie) '+
        'VALUES ('+connection.escape(userId)+','+connection.escape(Math.floor(Date.now()/1000))+
        ', '+connection.escape(sessionKey)+');', function(err) {
        connection.release();
        if(err) return cb(err);
        config.redisClient.set('cookie:'+sessionKey, userId, 'EX', 14400, function(err) {
          if(err) return cb(err);
          cb(null, sessionKey);
        });
      });
    });
  }

  function validateSession(userId, sessionKey, cb) {
    debug('validateSession: userId: '+userId+' sessionKey: '+sessionKey);
    if((typeof userId !== 'string' && typeof userId !== 'number') || typeof sessionKey !== 'string')
      return cb('invalid-input');
    config.redisClient.get('cookie:'+sessionKey, function(err, reply) {
      if(err) return cb(err);
      if(reply !== null) {
        if(parseInt(reply.toString(), 10) !== parseInt(userId, 10)) {
          debug('validateSession: session invalid');
          return cb('invalid-user');
        }
        debug('validateSession: session valid (redis)');
        return cb(null, true);
      }
      config.mysql.getConnection(function(err, connection) {
        if(err) return cb(err);
        connection.query('SELECT session_user_id AS userId, session_created AS created, '+
          'session_user_cookie AS userCookie FROM sessions '+
          'WHERE session_user_id = '+connection.escape(userId)+
          ' AND session_user_cookie = '+connection.escape(sessionKey)+';', function(err, rows) {
          connection.release();
          if(err) return cb(err);
          for(var i = 0, ii = rows.length; i < ii; i++) {
            // Check so that the created date isn't longer than 30 days
            if(rows[i].created + 2592000 < Math.floor(Date.now())) {
              debug('validateSession: session valid (MySQL)');
              config.redisClient.set('cookie:'+sessionKey, userId, 'EX', 14400, function(err) {
                if(err) return cb(err);
                cb(null, true);
              });
              return;
            }
          }
          debug('validateSession: session invalid');
          cb('no-user');
        });
      });
    });
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
        if(err) return cb(err, null);
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
        if(err) return cb(err, null);
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
      if(err) return cb(err, null);
      connection.query('SELECT * FROM users;', function(err, rows) {
        if(err) return cb(err, null);
        connection.release();
        debug('getAll: Users fetched: '+rows.length);
        cb(err, rows);
      });
    });
  }

  function getUserDetails(userDetails, cb) {
    debug('getUserDetails: userDetails:');
    debug(userDetails);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      function returnFromMySQL(err, rows) {
        if(err) return cb(err, null);
        connection.release();
        debug('getUserDetails: results from SQL:'+rows.length);
        if(rows.length === 0) {
          return cb('no-user-found', null);
        }
        cb(err, rows);
      }
      var query = 'SELECT '+
          'user_id AS id, '+
          'user_organization_id AS organizationId, '+
          'user_username AS username, '+
          'user_organization AS organization, '+
          'user_workplace AS workplace, '+
          'user_email AS email, '+
          'user_pemail AS pemail, '+
          'user_fname AS fname, '+
          'user_lname AS lname, '+
          'user_admin AS admin, '+
          'user_locked AS locked, '+
          'user_agreement AS agreement, '+
          'user_created AS created, '+
          'user_updated AS updated '+
          'FROM users ';
      if(typeof userDetails === 'number') {
        return connection.query(query +
          'WHERE user_id = '+connection.escape(userDetails)+';', returnFromMySQL);
      } else if(typeof userDetails === 'object') {
        if(userDetails.email) {
           return connection.query(query +
            'WHERE user_email = '+connection.escape(userDetails.email)+
            ' OR user_pemail = '+connection.escape(userDetails.email)+';', returnFromMySQL);
        } else if(userDetails.organization && userDetails.username) {
          return connection.query(query +
            'WHERE user_organization_id = '+connection.escape(userDetails.organization)+
            ' AND user_username = '+connection.escape(userDetails.username)+';', returnFromMySQL);
        }
      }
      cb('invalid-input', null);
    });
  }

  function clearLoginCookies(req) {
    req.cookies.set('login', '', {
      domain: '.' + req.headers.host,
      httpOnly: true,
      expires: new Date(0),
      maxAge: 0
    });
    req.cookies.set('login.sec', '', {
      domain: '.' + req.headers.host,
      httpOnly: true,
      secure: (config.development ? false : true),
      expires: new Date(0),
      maxAge: 0
    });
  }

  function user() {
    return true;
  }

  user.getAll             = getAll;
  user.hmac               = hmacUser;
  user.validateHmac       = validateHmacUser;
  user.getDetails         = getUserDetails;
  user.loginUsername      = loginUsername;
  user.loginEmail         = loginEmail;
  user.clearLoginCookies  = clearLoginCookies;
  user.validateSession    = validateSession;
  user.createSession      = createSession;
  user.validatePassword   = validatePassword; // For testing

  return user;
}

module.exports = users;