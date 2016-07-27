/* jshint browser: true, node: false, jquery: true */

(function($){
  'use strict';
  var topBar = $('nav');
  var fullPage = $('.fullPage');
  function resizeFullPage() {
    fullPage.css('padding-top', topBar.outerHeight() + 'px');
  }
  resizeFullPage();
  var timeoutStarted = false;
  $(window).on('resize', function(event) {
    if(!timeoutStarted) {
      timeoutStarted = true;
      setTimeout(function() {
        timeoutStarted = false;
        resizeFullPage();
      }, 50);
    }
  });
})(jQuery);
