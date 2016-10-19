/* jshint browser: true, node: false */

(function() {
  'use strict';

  var reEmail = /^[A-Z0-9._%+-]+@(?:[A-Z0-9-]+\.)+[A-Z]{2,}$/i;

  var organization          = document.getElementById('organization');
  var fname                 = document.getElementById('fname');
  var lname                 = document.getElementById('lname');
  var workplace             = document.getElementById('workplace');
  var organizationFreetext  = document.getElementById('organizationFreetext');
  var username              = document.getElementById('username');
  var email                 = document.getElementById('email');
  var emailP                = document.getElementById('emailP');
  var password              = document.getElementById('password');
  var passwordV             = document.getElementById('passwordV');

  function setError(el, bool) {
    if(bool) {
      el.style.boxShadow = '#FF0000 0px 0px 1.5px 1px';
      el.parentNode.style.color = '#FF0000';
    } else {
      el.style.boxShadow = '';
      el.parentNode.style.color = '';
    }
  }
  organization.onchange = function() {
    document.getElementById('afterOrgPick').style.display = 'block';
    var selectValue = document.getElementById('organization');
    var value = selectValue[selectValue.selectedIndex].value;
    var agr = '';
    for (var i = 0, ii = orgData.length; i < ii; i++){
      if (orgData[i].organization_id === value){
        agr = orgData[i].organization_user_agreement;
        document.getElementById('signUpAgr').innerHTML = agr;
      }
    }
    if(organization.dataset && organization.dataset.orgfreetext) {
      if(organization.dataset.orgfreetext.split(',').indexOf(organization.value) !== -1) {
        organizationFreetext.parentNode.style.display = 'block';
      } else {
        organizationFreetext.parentNode.style.display = 'none';
      }
    } else {
      organizationFreetext.parentNode.style.display = 'none';
    }
  };

  document.getElementsByTagName('form')[0].onsubmit = function() {
    var valid = true;
    if(!reEmail.test(email.value)) {
      setError(email, true);
      valid = false;
    } else {
      setError(email, false);
    }
    if(emailP.value && !reEmail.test(emailP.value)) {
      setError(emailP, true);
      valid = false;
    } else {
      setError(emailP, false);
    }
    if(!username.value || username.value.length < 5) {
      setError(username, true);
      valid = false;
    } else {
      setError(username, false);
    }
    var listCheck = [fname, lname, workplace, password, passwordV];
    if(organization.dataset && organization.dataset.orgfreetext) {
      if(organization.dataset.orgfreetext.split(',').indexOf(organization.value) !== -1) {
        listCheck.push(organizationFreetext);
      }
    }
    for (var i = listCheck.length - 1; i >= 0; i--) {
      if(!listCheck[i].value) {
        setError(listCheck[i], true);
        valid = false;
      } else {
        setError(listCheck[i], false);
      }
    }
    return valid;
  };
})();
