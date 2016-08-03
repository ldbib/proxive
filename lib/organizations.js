
'use strict';

const url   = require('url');
const debug = require('debug')('proxive:organizations');

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

  function saveEmailSettings(settings, cb) {
    debug('saveEmailSettings: organization id: '+settings.id);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('UPDATE organizations '+
        'SET organization_user_email_title = ?, '+
        'organization_user_email = ? '+
        'WHERE organization_id = ?;',
        [settings.userEmailTitle, settings.userEmail, settings.id],
        function(err) {
          if(err) return cb(err);
          connection.release();
          cb(null);
        }
      );
    });
  }
  function saveSettings(settings, cb) {
    debug('saveSettings: organization id: '+settings.id);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('UPDATE organizations '+
        'SET organization_name = ?, '+
        'organization_email = ?, '+
        'organization_pubmed_otool = ?, '+
        'organization_user_agreement = ? '+
        'WHERE organization_id = ?;',
        [settings.name, settings.email, settings.pubmedOtool, settings.userAgreement, settings.id],
        function(err) {
          if(err) return cb(err);
          connection.release();
          cb(null);
        }
      );
    });
  }

  function saveWiuSettings(settings, cb) { // TODO: send emails when WIU password is updated
    debug('saveWiuSettings: organization id: '+settings.id);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('UPDATE organizations '+
        'SET organization_wiu_ips = ?, '+
        'organization_wiu_password = ?, '+
        'organization_wiu_emails = ? '+
        'WHERE organization_id = ?;',
        [settings.wiuIps, settings.wiuPassword, settings.wiuEmails, settings.id],
        function(err) {
          connection.release();
          if(err) return cb(err);
          cb(null);
        }
      );
    });
  }

  function wiuBlockUrl(settings, cb) {
    var parsedUrl, domain;
    debug('wiuBlockUrl: organization id: '+settings.id);
    if(!settings.url || typeof settings.url !== 'string') {
      return cb('invalid-input');
    }
    parsedUrl = url.parse(settings.url.indexOf('http') === 0 ? settings.url : 'http://'+settings.url);
    if(parsedUrl.hostname === null) {
      return cb('invalid-input');
    }
    domain = parsedUrl.hostname;
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT wiubl_url AS url FROM wiubl WHERE wiubl_organization_id = ? AND wiubl_url = ?;',
        [settings.id, domain],
        function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          if(rows.length === 1) {
            connection.release();
            return cb('url-exist');
          }
          connection.query('INSERT INTO wiubl (wiubl_url, wiubl_organization_id) VALUES (?, ?);',
            [domain, settings.id],
            function(err) {
              connection.release();
              if(err) return cb(err);
              cb(null, domain);
            }
          );
        }
      );
    });
  }

  function getWiuUrls(orgId, cb) {
    debug('getWiuUrls: organization id: '+orgId);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT wiubl_url AS url FROM wiubl WHERE wiubl_organization_id = ?;',
        [orgId],
        function(err, rows) {
          connection.release();
          if(err) {
            return cb(err);
          }
          var urlArray = [];
          for(var i = 0, ii = rows.length; i < ii; i++) {
            urlArray.push(rows[i].url);
          }
          cb(null, urlArray);
        }
      );
    });
  }

  function searchWiuUrls(domain, orgId, cb) {
    var parsedUrl;
    debug('searchWiuUrls: organization id: '+orgId);
    if(!domain || typeof domain !== 'string') {
      return cb('invalid-input');
    }
    parsedUrl = url.parse(domain.indexOf('http') === 0 ? domain : 'http://'+domain);
    if(parsedUrl.hostname === null) {
      return cb('invalid-input');
    }
    domain = parsedUrl.hostname;
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT wiubl_url AS url FROM wiubl WHERE wiubl_organization_id = ? AND wiubl_url LIKE ?;',
        [orgId, '%'+domain],
        function(err, rows) {
          connection.release();
          if(err) {
            return cb(err);
          }
          var urlArray = [];
          for(var i = 0, ii = rows.length; i < ii; i++) {
            urlArray.push(rows[i].url);
          }
          cb(null, urlArray);
        }
      );
    });
  }

  function organization() {
    return true;
  }

  organization.getAll               = getAll;
  organization.getAllFiltered       = getAllFiltered;
  organization.getLimitedFromUser   = getLimitedOrgFromUser;
  organization.getFromUser          = getOrgFromUser;
  organization.getConnectIp         = getConnectIp;
  organization.saveEmailSettings    = saveEmailSettings;
  organization.saveSettings         = saveSettings;
  organization.saveWiuSettings      = saveWiuSettings;
  organization.wiuBlockUrl          = wiuBlockUrl;
  organization.getWiuUrls           = getWiuUrls;
  organization.searchWiuUrls        = searchWiuUrls;

  return organization;
}

module.exports = organizations;