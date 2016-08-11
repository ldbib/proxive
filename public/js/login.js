/* jshint browser: true, node: false */

(function() {
  'use strict';

  document.getElementById('loginUsernameButton').onclick = function() {
    document.getElementById('loginSelector').style.display = 'none';
    document.getElementById('loginForms').style.display = 'block';
    document.getElementById('loginUsername').style.display = 'block';
    document.getElementById('organization').focus();
  };
  document.getElementById('loginEmailButton').onclick = function() {
    document.getElementById('loginSelector').style.display = 'none';
    document.getElementById('loginForms').style.display = 'block';
    document.getElementById('loginEmail').style.display = 'block';
    document.getElementById('emailE').focus();
  };
  document.getElementById('wiuButton').onclick = function() {
    document.getElementById('loginSelector').style.display = 'none';
    document.getElementById('loginForms').style.display = 'block';
    document.getElementById('wiu').style.display = 'block';
    document.getElementById('emailE').focus();
  };
  document.getElementById('loginBack').onclick = function() {
    document.getElementById('loginSelector').style.display = 'block';
    document.getElementById('loginForms').style.display = 'none';
    document.getElementById('loginUsername').style.display = 'none';
    document.getElementById('loginEmail').style.display = 'none';
    document.getElementById('wiu').style.display = 'none';
    document.getElementById('loginUsernameButton').focus();
  };
  document.getElementById('createNewAccount').onclick = function() {
    window.location = '/signup';
  };
  document.getElementById('forgotButton').onclick = function() {
    window.location = '/remindMe';
  };
})();
