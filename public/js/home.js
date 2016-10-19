/* jshint browser: true, node: false */

(function() {
  'use strict';

  var topBar = document.getElementsByTagName('nav')[0];
  var fullPage = document.querySelector('.fullPage');
  function resizeFullPage() {
    fullPage.style.paddingTop = topBar.clientHeight+'px';
  }
  // Timeout used to ensure that everything is ready before we do the resize.
  setTimeout(resizeFullPage, 1);
  var timeoutStarted = false;
  window.onresize = function() {
    if(!timeoutStarted) {
      timeoutStarted = true;
      setTimeout(function() {
        timeoutStarted = false;
        resizeFullPage();
      }, 50);
    }
  };

  if(document.getElementById('directUrl') !== null) {
    var timeout, interval, directUrl, cancelInterval;

    directUrl = document.getElementById('directUrl').href;

    cancelInterval = function() {
      document.onkeydown = document.onmousedown = document.ontouchstart = null;
      clearInterval(interval);
      document.getElementsByTagName('h2')[0].textContent = 'Timer avbruten!';
      document.getElementsByTagName('p')[0].innerHTML = 'Fortsätt genom '+
        'att trycka på följande länk:<br><a href="'+directUrl+'">'+directUrl+'</a>';
    };

    timeout = 5;
    interval = setInterval(function() {
      document.getElementById('seconds').textContent = timeout + ' sekunder';
      if(timeout <= 0) {
        clearInterval(interval);
        window.location = directUrl;
      }
      timeout--;
    }, 1000);
    document.onkeydown = function(event) {
      if(event.keyCode === 27) {
        cancelInterval();
      }
    };
    document.onmousedown = document.ontouchstart = function() {
      cancelInterval();
    };
  }
})();
