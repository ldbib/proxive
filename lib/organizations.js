
'use strict';

var debug = require('debug')('proxive:organizations');

function organizations(config) {

  function getAll(cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT * FROM organizations;', function(err, rows) {
        connection.release();
        debug('getAll: Organizations fetched: '+rows.length);
        cb(err, rows);
      });
    });
  }
  function getAllFiltered(selects, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      for (var i = selects.length - 1; i >= 0; i--) {
        selects[i] = connection.escapeId(selects[i]);
      }
      debug('getAllFiltered: Selects: '+selects.join(', '));
      connection.query('SELECT '+selects.join(', ')+' FROM organizations;', function(err, rows) {
        connection.release();
        debug('getAllFiltered: Organizations fetched: '+rows.length);
        cb(err, rows);
      });
    });
  }

  function getOrgFromUser(userId, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      debug('getOrgFromUser: userId: '+userId);
      connection.query('SELECT '+
        'O.organization_id AS id, '+
        'O.organization_name AS name, '+
        'O.organization_assigned_ipv4 AS assignedIPv4, '+
        'O.organization_user_agreement AS userAgreement, '+
        'O.organization_user_email_title AS userEmailTitle, '+
        'O.organization_user_email AS userEmail, '+
        'O.organization_email AS email, '+
        'O.organization_direct_to_url AS directToUrl, '+
        'O.organization_direct_url AS directUrl, '+
        'O.organization_homepage_html AS homepageHtml, '+
        'O.organization_pubmed_otool AS pubmedOtool, '+
        'O.organization_wiu_password AS wiuPassword, '+
        'O.organization_wiu_ips AS wiuIps, '+
        'O.organization_wiu_emails AS wiuEmails '+
        'FROM organizations AS O '+
        'INNER JOIN users U ON O.organization_id = U.user_organization_id '+
        'WHERE U.user_id = '+connection.escape(userId)+';',
        function(err, rows) {
          if(err) return cb(err);
          connection.release();
          if(rows.length === 0) {
            debug('getOrgFromUser: No organization found!');
            return cb('no-org', null);
          }
          cb(null, rows[0]);
        }
      );
    });
  }

  function getLimitedOrgFromUser(userId, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      debug('getOrgFromUser: userId: '+userId);
      connection.query('SELECT O.organization_id AS id, '+
        'O.organization_user_agreement AS userAgreement, '+
        'O.organization_direct_to_url AS directToUrl, '+
        'O.organization_direct_url AS directUrl, '+
        'O.organization_email AS email '+
        'FROM organizations O '+
        'INNER JOIN users U ON O.organization_id = U.user_organization_id '+
        'WHERE U.user_id = '+connection.escape(userId)+';', function(err, rows) {
        connection.release();
        if(rows.length === 0) {
          debug('getOrgFromUser: No organization found!');
          return cb('no-org', null);
        }
        cb(null, rows[0]);
      });
    });
  }

  function getConnectIp(userId, cb) {
    debug('getConnectIp: userId:'+userId);
    if(typeof userId !== 'string' && typeof userId !== 'number')
      return cb('invalid-input');
    config.redisClient.get('users-org-ip:'+userId, function(err, reply) {
      if(err) return cb(err);
      if(reply !== null) {
        return cb(null, reply);
      }
      debug('getConnectIp: redis didn\'t have the ip');
      config.mysql.getConnection(function(err, connection) {
        if(err) return cb(err);
        connection.query('SELECT O.organization_assigned_ipv4 AS assignedIp FROM organizations O '+
          'INNER JOIN users U ON O.organization_id = U.user_organization_id '+
          'WHERE U.user_id = '+connection.escape(userId)+';', function(err, rows) {
          connection.release();
          if(err) return cb(err);
          if(rows.length === 0) {
            return cb('organization-not-found');
          }
          config.redisClient.set('users-org-ip:'+userId, rows[0].assignedIp, function(err) {
            if(err) return cb(err);
            debug('getConnectIp: redis should have the ip now');
            cb(null, rows[0].assignedIp);
          });
        });
      });
    });
  }

  function organization() {
    return true;
  }

  organization.getAll             = getAll;
  organization.getAllFiltered     = getAllFiltered;
  organization.getLimitedFromUser = getLimitedOrgFromUser;
  organization.getFromUser        = getOrgFromUser;
  organization.getConnectIp       = getConnectIp;

  return organization;
}

module.exports = organizations;