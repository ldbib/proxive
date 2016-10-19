/* jshint browser: true, node: false */

(function() {
  'use strict';

  document.getElementById('loginUsernameButton').onclick = function() {
    document.getElementById('loginSelector').style.display = 'none';
    document.getElementById('loginForms').style.display = 'block';
    document.getElementById('loginUsername').style.display = 'block';
    document.getElementById('organization').focus();
    if (document.getElementById("redirectUrlUser").value === ''){
      if (getParameter('redirect')){
        var url = window.location.href.split('redirect=');
        url = url[1];
        document.getElementById("redirectUrlUser").value = url; 
      }
    }
  };
  document.getElementById('loginEmailButton').onclick = function() {
    if (getParameter('redirect')){
        var url = window.location.href.split('redirect=');
        url = url[1];
      window.location = '/loginEmail?' + 'redirect=' + url;
    }
    else {
      window.location = '/loginEmail';
    }
  };
  /*document.getElementById('wiuButton').onclick = function() {
    document.getElementById('loginSelector').style.display = 'none';
    document.getElementById('loginForms').style.display = 'block';
    document.getElementById('wiu').style.display = 'block';
    document.getElementById('emailE').focus();
    if (document.getElementById("redirectUrlWiu").value === ''){
      var url = getParameter('redirectUrl');
      document.getElementById("redirectUrlWiu").value = url;
    }
  };*/
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

function getParameter(paramName) {
  var searchString = window.location.search.substring(1),
      i, val, params = searchString.split("&");

  for (i=0;i<params.length;i++) {
    val = params[i].split("=");
    if (val[0] == paramName) {
      return params[i].replace('redirectUrl=', '');
    }
  }
  return null;
}