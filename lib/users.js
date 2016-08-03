
'use strict';

var crypto  = require('crypto');
var qs      = require('querystring');
var debug   = require('debug')('proxive:users');

var randomstring = require('randomstring').generate;

function users(config) {

  const reEmail = /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$/i;

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

  function generateSalt(saltLength) {
    return randomstring({
      length: (!isNaN(parseInt(saltLength, 10)) ? parseInt(saltLength, 10) : 32),
      charset: '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ!@#$%&/{([)]=}?+*\'.,-_:;'
    });
  }

  function hashPassword(plainPass) {
    var salt = generateSalt(32);
    var calculatedHash = sha512(plainPass + salt + config.publicSalt);
    for(var i = 0; i < 16384; i++) {
      calculatedHash = sha512(calculatedHash + salt + config.publicSalt);
    }
    return salt + calculatedHash;
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

  function getUsersFromOrg(orgId, cb) {
    debug('getUsersFromOrg: orgId: '+orgId);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err, null);
      connection.query('SELECT '+
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
        'FROM users '+
        'WHERE user_organization_id = '+connection.escape(orgId)+';',
        function(err, rows) {
          if(err) return cb(err, null);
          connection.release();
          debug('getUsersFromOrg: Users fetched: '+rows.length);
          cb(err, rows);
        }
      );
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
        cb(null, rows[0]);
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
        if(!isNaN(userDetails)) {
          return connection.query(query +
            'WHERE user_id = '+connection.escape(userDetails)+';', returnFromMySQL);
        }
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

  // Doesn't affect admin status which is done in the updateAdmin function.
  function saveUser(details, cb) {
    var passwordSQL = '';
    var passwordArr = [];
    if(typeof details.password === 'string' && details.password) {
      passwordArr = [hashPassword(details.password)];
      passwordSQL = ', user_password = ?';
      details.password = '-encrypted-'; // to display to debug() below.
    }
    debug('saveUser: details:');
    debug(details);
    // Set values to null if they are empty and can be null.
    details.pemail = details.pemail ? details.pemail : null;
    details.organization = details.organization ? details.organization : null;

    // Validate that the required inputs are avaliable.
    if(!details.organizationId || !details.email || !details.username || !details.fname || !details.lname || !details.id || !details.workplace) {
      return cb('missing-input');
    }

    // Validate emails
    if(details.email.length > 254 || (details.pemail && (details.pemail.length > 254 || !reEmail.test(details.pemail))) || !reEmail.test(details.email)) {
      return cb('invalid-email');
    }

    // MySQL want 1 and 0 not true and false
    details.locked = details.locked === 'true' ? 1 : 0;
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT user_id AS id '+
        'FROM users '+
        'WHERE (user_organization_id = ? AND user_username = ?) '+
        'OR user_email = ? OR user_pemail = ?;',
        [details.organizationId, details.username, details.email, details.pemail],
        function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          for(var i = 0, ii = rows.length; i < ii; i++) {
            if(rows[i].id !== details.id) {
              connection.release();
              return cb('conflicting-details');
            }
          }
          connection.query('UPDATE users '+
            'SET user_organization_id = ?, user_username = ?, user_organization = ?, '+
            'user_workplace = ?, user_email = ?, user_pemail = ?, user_fname = ?, '+
            'user_lname = ?, user_locked = ?, user_updated = ? '+passwordSQL+
            'WHERE user_id = ?;',
            [details.organizationId, details.username, details.organization, details.workplace, details.email,
            details.pemail, details.fname, details.lname, details.locked, Date.now()].concat(passwordArr, [details.id]),
            function(err) {
              connection.release();
              if(err) return cb(err);
              cb(null);
            }
          );
        }
      );
    });
  }

  function updateAdmin(userId, adminLevel, cb) {
    debug('updateAdmin: userId: '+userId+' adminLevel: '+adminLevel);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('UPDATE users '+
        'SET user_admin = ? '+
        'WHERE user_id = ?;',
        [adminLevel, userId],
        function(err) {
          if(err) return cb(err);
          connection.release();
          cb(null);
        }
      );
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
      secure: config.https,
      expires: new Date(0),
      maxAge: 0
    });
  }

  function renderLogin(req, res) {
    config.organizations.getAllFiltered(['organization_id', 'organization_name'], function(err, organizations) {
      if(err) {
        console.error(err);
        res.writeHead(500, {
          'content-type': 'text/html; charset=utf-8'
        });
        return res.end(config.pugGen.run['500.pug']({title: 'MySQL fel!',
          message: ''}));
      }
      var redirect = null;
      var parsedQuery = '';
      if(req.url.indexOf('?') !== -1) {
        parsedQuery = qs.parse(req.url.substring(req.url.indexOf('?')+1));
        if(parsedQuery.redirect) {
          redirect = parsedQuery.redirect;
        }
      }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8'
      });
      return res.end(config.pugGen.run['login.pug']({organizations: organizations, redirect: redirect}));
    });
  }

  function recreateLoginCookie(res, user, data) {
    // Set cookie for browsing for 4 hours
    var fourHours  = Math.floor(Date.now()/1000) + 14400;
    res.cookies.set('login', config.users.hmac(user, fourHours, data), {
      expires: fourHours,
      maxAge: 14400000,
      domain: '.' + config.loginServer.domain,
      httpOnly: true
    });
  }

  function validateSignin(req, res, jsonResponse, cb) {
    if(typeof jsonResponse === 'function') {
      cb = jsonResponse;
      jsonResponse = false;
    }
    if(req.cookies.get('login.sec')) {
      var cookieInfo = config.users.validateHmac(req.cookies.get('login.sec'));
      if(typeof cookieInfo === 'object' && cookieInfo.data.indexOf('secure:') === 0) {
        config.users.validateSession(cookieInfo.user, cookieInfo.data.replace('secure:', ''), function(err) {
          if(err) {
            console.error(err);
            if(err === 'invalid-user' || err === 'no-user') {
              config.users.clearLoginCookies(req);
              if(jsonResponse) {
                res.writeHead(403, {
                  'content-type': 'application/json; charset=utf-8'
                });
                return res.end('{"error": "Please signin first!"}');
              }
              res.writeHead(302, {
                location: (config.https ? 'https://' : 'http://') + config.loginServer.domain
              });
              return res.end();
            } else {
              if(jsonResponse) {
                res.writeHead(500, {
                  'content-type': 'application/json; charset=utf-8'
                });
                return res.end('{"error": "Something went wrong with signin validation!"}');
              }
              res.writeHead(500, {'content-type': 'text/html; charset=utf-8'});
              return res.end(config.pugGen.run['500.pug']({title: 'Ett fel inträffade vid valideringen av inloggningsuppgifterna!',
                message: 'Prova att ladda om sidan om en liten stund.'}));
            }
          }

          // If the login cookie isn't avaliable we recreate it since we have a valid login.sec cookie.
          if(!req.cookies.get('login')) {
            recreateLoginCookie(res, cookieInfo.user, cookieInfo.data.replace('secure:', ''));
          } else {
            var loginCookie = config.users.validateHmac(req.cookies.get('login'));
            if(loginCookie === false) {
              recreateLoginCookie(res, cookieInfo.user, cookieInfo.data.replace('secure:', ''));
            } else {
              if(loginCookie.data !== cookieInfo.data.replace('secure:', '')) {
                recreateLoginCookie(res, cookieInfo.user, cookieInfo.data.replace('secure:', ''));
              }
            }
          }

          debug('user: '+ cookieInfo.user);
          config.users.getDetails(parseInt(cookieInfo.user, 10), function(err, userData) {
            if(err) {
              console.error(err);
              if(err === 'no-user-found') {
                config.users.clearLoginCookies(req);
                if(jsonResponse) {
                  res.writeHead(403, {
                    'content-type': 'application/json; charset=utf-8'
                  });
                  return res.end('{"error": "Please signin first!"}');
                }
                return renderLogin(req, res);
              } else {
                if(jsonResponse) {
                  res.writeHead(500, {
                    'content-type': 'application/json; charset=utf-8'
                  });
                  return res.end('{"error": "Something went wrong with signin validation!"}');
                }
                res.writeHead(500, {
                  'content-type': 'text/html; charset=utf-8'
                });
                return res.end(config.pugGen.run['500.pug']({title: 'Något gick fel!',
                  message: 'Försök igen!'})); // TODO better error message
              }
            }
            cb(userData);
          });
        });
      }
    } else {
      if(jsonResponse) {
        res.writeHead(403, {
          'content-type': 'application/json; charset=utf-8'
        });
        return res.end('{"error": "Please signin first!"}');
      }
      renderLogin(req, res);
    }
  }
  function validateAdmin(req, res, jsonResponse, cb) {
    if(typeof jsonResponse === 'function') {
      cb = jsonResponse;
      jsonResponse = false;
    }
    validateSignin(req, res, jsonResponse, function(userData) {
      if(userData.admin > 0) {
        cb(userData);
      } else {
        if(jsonResponse) {
          res.writeHead(403, {
            'content-type': 'application/json; charset=utf-8'
          });
          return res.end('{"error": "Permission denied!"}');
        }
        // Not admin so redirect to /
        res.writeHead(302, {
          location: (config.https ? 'https://' : 'http://') + config.loginServer.domain
        });
        res.end();
      }
    });
  }

  function user() {
    return true;
  }

  user.getAll             = getAll;
  user.getUsersFromOrg    = getUsersFromOrg;
  user.save               = saveUser;
  user.updateAdmin        = updateAdmin;
  user.hmac               = hmacUser;
  user.validateHmac       = validateHmacUser;
  user.getDetails         = getUserDetails;
  user.loginUsername      = loginUsername;
  user.loginEmail         = loginEmail;
  user.clearLoginCookies  = clearLoginCookies;
  user.validateSession    = validateSession;
  user.createSession      = createSession;
  user.renderLogin        = renderLogin;
  user.validateSignin     = validateSignin;
  user.validateAdmin      = validateAdmin;
  user.validatePassword   = validatePassword; // For testing

  return user;
}

module.exports = users;