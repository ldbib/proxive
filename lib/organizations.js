
'use strict';

function organizations(config) {

  function getAll(cb) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      connection.query('SELECT * FROM organizations;', function(err, rows) {
        connection.release();
        cb(err, rows);
      });
    });
  }
  function getAllFiltered(cb, selects) {
    config.mysql.getConnection(function(err, connection) {
      if(err) return cb(err);
      for (var i = selects.length - 1; i >= 0; i--) {
        selects[i] = connection.escapeId(selects[i]);
      }
      connection.query('SELECT '+selects.join(', ')+' FROM organizations;', function(err, rows) {
        connection.release();
        cb(err, rows);
      });
    });
  }

  function organization() {
    return true;
  }

  organization.getAll         = getAll;
  organization.getAllFiltered = getAllFiltered;

  return organization;
}

module.exports = organizations;