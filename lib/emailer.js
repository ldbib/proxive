'use strict';

const nodemailer    = require('nodemailer');
const crypto        = require('crypto');
const randomstring  = require('randomstring').generate;
const debug         = require('debug')('proxive:emailer');

module.exports = function(config) {

  var server = nodemailer.createTransport(config.email.nodemailer);

  server.verify(function(error) {
    if(error) {
      console.error(error);
    } else {
      console.log('Emailserver is ready to take our messages!');
    }
  });

  function hmacEmail(userid, expiry, data) {
    data = (data ? data : randomstring(16));
    let dynamicKey = crypto.createHmac('sha512', config.serverPrivateKey).update(userid+'|'+expiry).digest('hex');
    let encrypted = crypto.createHmac('sha512', dynamicKey).update(userid+'|'+expiry+'|'+data).digest('hex');
    let finalOutput = userid+'|'+expiry+'|'+data+'|'+encrypted;
    return finalOutput;
  }

  function validateHmacEmail(hmac) {
    if(!hmac) {
      return false;
    }
    let parts = hmac.split('|');
    if(parts[1] <= Math.floor(Date.now()/1000)) {
      return false;
    }
    let dynamicKey = crypto.createHmac('sha512', config.serverPrivateKey).update(parts[0]+'|'+parts[1]).digest('hex');
    let encrypted = crypto.createHmac('sha512', dynamicKey).update(parts[0]+'|'+parts[1]+'|'+parts[2]).digest('hex');
    let finalOutput = parts[0]+'|'+parts[1]+'|'+parts[2]+'|'+encrypted;
    if(hmac === finalOutput) {
      return {user: parts[0], data: parts[2]};
    }
    return false;
  }

  function dispatchWIUPassword(password, emails, settings, cb) {
    debug('dispatchWIUPassword');
    server.sendMail({
      from:     config.email.address,
      to:       emails,
      subject:  'Proxive Walk In Use lösenord ändrat!',
      text:     'Proxives lösenord är nu: '+password+'\n\rLänk: http'+(config.https ? 's' : '')+
                '://'+config.loginServer.domain+'/',
      html:     '<html><body>\nProxives lösenord är nu:<br/><br/>\n'+password+'\n<br/><br/>\n'+
                '<a href="http'+(config.https ? 's' : '')+'://'+config.loginServer.domain+'/">'+
                'http'+(config.https ? 's' : '')+'://'+config.loginServer.domain+'/</a></body></html>'
    }, cb);
  }

  function checkRecoveryKey(userId, key, cb) {
    debug('checkRecoveryKey: userId: '+userId+' key: '+key);
    if(typeof userId !== 'string' && typeof userId !== 'number')
      return cb('invalid-input');
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT recovery_id FROM recoveries WHERE recovery_user_id = ?'+
        'AND recovery_key = ? AND recovery_used = 0;',
        [userId, key], function(err, rows) {
          connection.release();
          if(err) {
            return cb(err);
          }
          if(rows.length === 0) {
            return cb('non-existant');
          }
          cb(null);
        }
      );
    });
  }

  function createRecoveryKey(userId, cb) {
    debug('createRecoveryKey: userId: '+userId);
    if(typeof userId !== 'string' && typeof userId !== 'number')
      return cb('invalid-input');
    var recoveryKey = randomstring(32);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT recovery_id FROM recoveries WHERE recovery_key = ?;',
        [recoveryKey], function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          if(rows.length > 0) {
            connection.release();
            return createRecoveryKey(userId, cb); // retry
          }
          connection.query('INSERT INTO recoveries(recovery_user_id, recovery_created, recovery_key) '+
            'VALUES (?, ?, ?);',
            [userId, Math.floor(Date.now()/1000), recoveryKey],
            function(err) {
              connection.release();
              if(err) return cb(err);
              cb(null, recoveryKey);
            }
          );
        }
      );
    });
  }

  function dispatchResetPasswordLink(user, cb) {
    debug('dispatchResetPasswordLink: user.id: '+user.id);
    createRecoveryKey(user.id, function(err, key) {
      if(err) return cb(err);
      debug('dispatchResetPasswordLink: sending email');
      let link = 'http'+(config.https ? 's' : '')+'://'+config.loginServer.domain+
        '/resetPassword?u='+hmacEmail(user.id, Math.floor(Date.now()/1000)+86400, key);
      server.sendMail({
        from: config.email.address,
        to: user.email + (user.pemail ? ', '+user.pemail : ''),
        subject: 'Lösenordsåterställning',
        text: 'Hej,\n\rDitt användarnamn är '+user.username+'\n\rLösenordsåterställningslänk: '+link+'\n\rHälsningar Proxive',
        html: '<html><body>\n'+
          'Hej '+user.fname+',<br/><br/>\n'+
          'Ditt användarnamn är : <strong>'+user.username+'</strong><br/><br/>\n'+
          '<a href="'+link+'">Tryck här för att återställa ditt lösenord!</a> Länken fungerar bara i 24 timmar!<br/><br/>\n'+
          'Hälsningar,<br/>\n'+
          'Proxive\n'+
          '</body></html>'
      }, cb);
    });
  }

  function newUserEmail(organization_id, cb) {
    debug('newUserEmail');
    if(!organization_id) {
      return cb('no-email-set');
    }
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT organization_email FROM organizations WHERE organization_id = ?;',
        [organization_id], function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          debug('newUserEmail');
          server.sendMail({
            from: config.email.address,
            to: rows[0].organization_email,
            subject: 'Ny användare i Proxive',
            text: 'En ny användare har registrerat sig i Proxive!',
            html: '<html><body>\n'+
              'En ny användare har registrerat sig i Proxive!\n'+
              '</body></html>'
          }, cb);
        }
      );
    });
  }

  function userApprovedEmail(organization_id, email, pemail, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT organization_user_email, organization_user_email_title, organization_email FROM organizations WHERE organization_id = ?;',
        [organization_id], function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          debug('userApprovedEmail');
          if(!rows[0].organization_user_email) {
            return cb('no-email-message-set');
          }
          if(!rows[0].organization_user_email_title) {
            return cb('no-email-message-set');
          }
          if(!rows[0].organization_email) {
            cb('no-email-set');
          }
          server.sendMail({
            from: config.email.address,
            to: email,
            headers: {
              'Reply-To': rows[0].organization_email
            },
            subject: rows[0].organization_user_email_title,
            html: rows[0].organization_user_email
          }, cb);
          if (pemail && pemail !== ''){
            server.sendMail({
              from: config.email.address,
              to: pemail,
              headers: {
                'Reply-To': rows[0].organization_email
              },
              subject: rows[0].organization_user_email_title,
              html: rows[0].organization_user_email
            }, cb);
          }
        }
      );
    });
  }

  return {
    hmacEmail:                  hmacEmail,
    validateHmacEmail:          validateHmacEmail,
    dispatchResetPasswordLink:  dispatchResetPasswordLink,
    dispatchWIUPassword:        dispatchWIUPassword,
    checkRecoveryKey:           checkRecoveryKey,
    newUserEmail:               newUserEmail,
    userApprovedEmail:          userApprovedEmail
  };
};
