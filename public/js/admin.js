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

  function createCover(text, time) {
    $('body').prepend('<div class="cover"></div><div class="coverText"></div>');
    $('.cover, .coverText').hide();
    $('body').children('.coverText').text(text);
    $('.cover, .coverText').fadeIn(200);
    if(time !== false) {
      setTimeout(function() {
        $('.cover, .coverText').fadeOut(200, function() {
          this.remove();
        });
      }, (time ? time : 2000));
    } else {
      $('body').append('<div class="coverTextSmall">Clicka var som helst för att stänga!</div>');
      $('.cover, .coverText').on('click', function() {
        $('.cover, .coverText').off('click');
        $('.cover, .coverText').fadeOut(200, function() {
          this.remove();
        });
      });
    }
  }

  if($('#userEdit').length === 1) {
    $('#userList').on('click', 'tr', function() {
      if(this.id === 'user-new') {
        $('#userEdit').find('input').val('');
        $('#userEdit').find('input[type=checkbox]').prop('checked', false);
      } else {
        $.ajax({
          method: 'GET',
          url: '/admin/userData',
          dataType: 'json',
          data: {
            id: parseInt(this.id.substr(5) ,10)
          }
        })
        .done(function(data) {
          for(var key in data) {
            if(key === 'organizationId') {
              $('#organizationId').find('option').prop('selected', false);
              $('#organizationId').find('option[value='+data[key]+']').prop('selected', true);
            } else if(['created', 'updated'].indexOf(key) !== -1) {
              if(data[key] === 0) {
                $('#'+key).val('');
              } else {
                $('#'+key).val((new Date(data[key] * 1000)).toString());
              }
            } else if(['admin', 'locked'].indexOf(key) !== -1) {
              $('#'+key).prop('checked', data[key] > 0 ? true : false);
            } else {
              $('#'+key).val(data[key]);
            }
          }
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          alert('Någonting gick snett. Försök igen lite senare.');
          if(console && console.log) {
            console.log(errorThrown);
            console.log(jqXHR);
          }
        });
      }
    });
    $('#saveUserDetails').on('click', function() {
      $.ajax({
        method: 'POST',
        url: '/admin/userData',
        dataType: 'json',
        data: ''
      })
      .done(function() {
        createCover('Användare sparad!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        alert('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.');
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
  }
})(jQuery);
