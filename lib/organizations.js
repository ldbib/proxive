
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
      connection.query('SELECT O.* FROM organizations O '+
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

  function organization() {
    return true;
  }

  organization.getAll             = getAll;
  organization.getAllFiltered     = getAllFiltered;
  organization.getLimitedFromUser = getLimitedOrgFromUser;
  organization.getFromUser        = getOrgFromUser;

  return organization;
}

module.exports = organizations;