
'use strict';

const url   = require('url');
const debug = require('debug')('proxive:organizations');

function organizations(config) {

  function getAll(cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT * FROM organizations;', function(err, rows) {
        connection.release();
        if(err) return cb(err);
        debug('getAll: Organizations fetched: '+rows.length);
        cb(null, rows);
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
      connection.query('SELECT '+selects.join(', ')+' FROM organizations ORDER BY organization_name;', function(err, rows) {
        connection.release();
        if(err) return cb(err);
        debug('getAllFiltered: Organizations fetched: '+rows.length);
        cb(null, rows);
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
        'O.organization_wiu_emails AS wiuEmails, '+
        'O.organization_domains AS domains '+
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
        'O.organization_homepage_html AS homepageHtml, '+
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

  function getConnectOrgIdAndIp(userId, cb) {
    debug('getConnectOrgIdAndIp: userId:'+userId);
    if(typeof userId !== 'string' && typeof userId !== 'number')
      return cb('invalid-input');
    config.redisClient.get('users-org-data:'+userId, function(err, reply) {
      if(err) return cb(err);
      if(reply !== null) {
        reply = reply.split(',');
        return cb(null, reply[0], reply[1]);
      }
      debug('getConnectOrgIdAndIp: redis didn\'t have the data');
      config.mysql.getConnection(function(err, connection) {
        if(err) return cb(err);
        connection.query('SELECT O.organization_assigned_ipv4 AS assignedIp, organization_id AS id FROM organizations O '+
          'INNER JOIN users U ON O.organization_id = U.user_organization_id '+
          'WHERE U.user_id = '+connection.escape(userId)+';', function(err, rows) {
          connection.release();
          if(err) return cb(err);
          if(rows.length === 0) {
            return cb('organization-not-found');
          }
          config.redisClient.set('users-org-data:'+userId, rows[0].id + ',' + rows[0].assignedIp, function(err) {
            if(err) return cb(err);
            debug('getConnectOrgIdAndIp: redis should have the data now');
            cb(null, rows[0].id, rows[0].assignedIp);
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

  // Yes the order is correct. I use this function with bind to pass connection and cb and let the query fill in err and rows.
  function listResponse(connection, cb, err, rows) {
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

  function listResponseObject(connection, cb, err, rows) {
    connection.release();
    if(err) {
      return cb(err);
    }
    var urlArray = [];
    for(var i = 0, ii = rows.length; i < ii; i++) {
      urlArray.push({"id": rows[i].id, "url": rows[i].url});
    }
    cb(null, urlArray);
  }

  function getWiuUrls(orgId, cb) {
    debug('getWiuUrls: organization id: '+orgId);
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT wiubl_url AS url FROM wiubl WHERE wiubl_organization_id = ?;',
        [orgId],
        listResponse.bind(null, connection, cb)
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
        listResponse.bind(null, connection, cb)
      );
    });
  }

  function addWhiteList(domain, cb) {
    var parsedUrl;
    debug('wiuBlockUrl: domain: '+domain);
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
      connection.query('SELECT whitelist_url AS url FROM whitelists WHERE whitelist_url = ?;',
        [domain],
        function(err, rows) {
          if(err) {
            connection.release();
            return cb(err);
          }
          if(rows.length === 1) {
            connection.release();
            return cb('url-exist');
          }
          connection.query('INSERT INTO whitelists (whitelist_url) VALUES (?);',
            [domain],
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

  function getWhiteListUrls(cb) {
    debug('getWhiteListUrls');
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT whitelist_url AS url FROM whitelists;',
        listResponse.bind(null, connection, cb)
      );
    });
  }

  function searchWhiteListUrls(domain, cb) {
    var parsedUrl;
    debug('searchWhiteListUrls: domain: '+domain);
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
      connection.query('SELECT whitelist_url AS url, whitelist_id as id FROM whitelists WHERE whitelist_url LIKE ?;',
        ['%'+domain],
        listResponseObject.bind(null, connection, cb)
      );
    });
  }

  function deleteWhiteListUrls(id, cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('DELETE FROM whitelists WHERE whitelist_id = ?;',
        [id],
        function(err, rows) {
          connection.release();
          if(err) return cb(err);
          cb(null, rows);
        }
      );
    });
  }

  function saveHomepageSettings(data, cb) {
    if(!data.directToUrl) {
      return cb('invalid-input');
    }
    data.directToUrl = data.directToUrl === 'true' ? 1 : 0;
    if((data.directToUrl && !data.directUrl) || (!data.directToUrl && !data.homepageHtml)) {
      return cb('invalid-input');
    }
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('UPDATE organizations '+
        'SET organization_direct_url = ?, organization_homepage_html = ?, '+
        'organization_direct_to_url = ? '+
        'WHERE organization_id = ?;',
        [data.directUrl, data.homepageHtml, data.directToUrl, data.id],
        function(err) {
          connection.release();
          if(err) return cb(err);
          cb(null);
        }
      );
    });
  }

  function searchLogs(orgId, search, cb) {
    if (!search){
      config.mysql.getConnection(function(err, connection) {
        if(err) return cb(err);
        connection.query('SELECT u.user_username AS username, log_id AS id, log_user_id AS userId, '+
          'log_message AS message, log_unix AS unix, '+
          'log_ip AS ip, log_os AS os, log_ua AS ua, '+
          'log_device AS device '+
          'FROM logs '+
          'INNER JOIN users AS u ON u.user_id = log_user_id '+
          'ORDER BY log_id DESC LIMIT 1000;',
          function(err, rows) {
            connection.release();
            if(err) return cb(err);
            cb(null, rows);
          }
        );
      });
    }
    else {
      config.mysql.getConnection(function(err, connection) {
        if(err) return cb(err);
        connection.query('SELECT u.user_username AS username, log_id AS id, log_user_id AS userId, '+
          'log_message AS message, log_unix AS unix, '+
          'log_ip AS ip, log_os AS os, log_ua AS ua, '+
          'log_device AS device '+
          'FROM logs '+
          'INNER JOIN users AS u ON u.user_id = log_user_id '+
          'WHERE u.user_organization_id = ? '+
          'AND u.user_username LIKE ? ORDER BY log_id DESC;',
          [orgId, '%'+search+'%'],
          function(err, rows) {
            connection.release();
            if(err) return cb(err);
            cb(null, rows);
          }
        );
      }); 
    }
  }

  function getBrowZineDetails(data, isId, cb) {
    if(typeof isId === 'function') {
      cb = isId;
      isId = false;
    }
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      if(isId) {
        connection.query('SELECT '+
          'organization_id AS id, '+
          'organization_name AS name, '+
          'organization_domains AS domains '+
          'FROM organizations '+
          'WHERE organization_id = ?;',
          [data],
          function (err, rows) {
            connection.release();
            if(err) return cb(err);
            if(rows.length === 0) return cb('no-org');
            cb(null, rows[0]);
          }
        );
      } else {
        connection.query('SELECT '+
          'organization_id AS id, '+
          'organization_name AS name, '+
          'organization_domains AS domains '+
          'FROM organizations;',
          function (err, rows) {
            connection.release();
            if(err) return cb(err);
            for(var i = 0, ii = rows.length; i < ii; i++) {
              rows[i].domains = rows[i].domains.split(',');
              for(var j = 0, jj = rows[i].domains.length; j < jj; j++) {
                if(data === rows[i].domains[j].trim()) {
                  return cb(null, rows[i]);
                }
              }
            }
            cb('no-org');
          }
        );
      }
    });
  }

  function organization() {
    return true;
  }

  organization.getAll               = getAll;
  organization.getAllFiltered       = getAllFiltered;
  organization.getLimitedFromUser   = getLimitedOrgFromUser;
  organization.getFromUser          = getOrgFromUser;
  organization.getConnectOrgIdAndIp = getConnectOrgIdAndIp;
  organization.saveEmailSettings    = saveEmailSettings;
  organization.saveSettings         = saveSettings;
  organization.saveWiuSettings      = saveWiuSettings;
  organization.wiuBlockUrl          = wiuBlockUrl;
  organization.getWiuUrls           = getWiuUrls;
  organization.searchWiuUrls        = searchWiuUrls;
  organization.addWhiteList         = addWhiteList;
  organization.getWhiteListUrls     = getWhiteListUrls;
  organization.searchWhiteListUrls  = searchWhiteListUrls;
  organization.deleteWhiteListUrls  = deleteWhiteListUrls;
  organization.searchLogs           = searchLogs;
  organization.saveHomepageSettings = saveHomepageSettings;
  organization.getBrowZineDetails   = getBrowZineDetails;

  return organization;
}

module.exports = organizations;