/* jshint browser: true, node: false, jquery: true */
/* global tinymce */

(function($){
  'use strict';
  var topBar = $('nav');
  var fullPage = $('.fullPage');
  function resizeFullPage() {
    fullPage.css('padding-top', topBar.outerHeight() + 'px');
  }
  // Timeout used to ensure that everything is ready before we do the resize.
  setTimeout(resizeFullPage, 1);
  var timeoutStarted = false;
  $(window).on('resize', function() {
    if(!timeoutStarted) {
      timeoutStarted = true;
      setTimeout(function() {
        timeoutStarted = false;
        resizeFullPage();
      }, 50);
    }
  });

  function createCover(text, time) {
    $('body').prepend('<div class="cover"></div><div class="coverText"><div></div></div>');
    $('.cover, .coverText').hide();
    $('body').find('.coverText div').text(text);
    $('.cover, .coverText').fadeIn(200);
    $('.coverText').css('height', $('.coverText div').outerHeight() + 'px');
    if(time !== false) {
      setTimeout(function() {
        $('.cover, .coverText').fadeOut(200, function() {
          this.remove();
        });
      }, (time ? time : 2000));
    } else {
      $('body').append('<div class="coverTextSmall">Clicka var som helst för att stänga!</div>');
      $('.cover, .coverText, .coverTextSmall').on('click', function() {
        $('.cover, .coverText, .coverTextSmall').off('click');
        $('.cover, .coverText, .coverTextSmall').fadeOut(200, function() {
          this.remove();
        });
      });
    }
  }

  if($('#settingsPicker').length === 1) {
    tinymce.init({
      selector: '#userEmail',
      language: 'sv_SE',
      height: 300,
      plugins: [
        'autolink code contextmenu image insertdatetime link table textcolor'
      ],
      toolbar: 'undo redo | styleselect forecolor backcolor | '+
        'bold underline italic | alignleft aligncenter alignright alignjustify | '+
        'bullist numlist outdent indent | link image'
    });
    $('#saveEmailSettings').on('click', function() {
      var data = {
        id: $('#id').val(),
        userEmailTitle: $('#userEmailTitle').val(),
        userEmail: tinymce.get('userEmail').getContent()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/emailSettings',
        dataType: 'json',
        data: data
      })
      .done(function() {
        createCover('Inställningar sparade!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#saveOrganizationSettings').on('click', function() {
      var data = {
        id: $('#id').val(),
        name: $('#organizationName').val(),
        email: $('#organizationEmail').val(),
        pubmedOtool: $('#organizationPubmedOtool').val(),
        userAgreement: $('#organizationUserAgreement').val()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/organizationSettings',
        dataType: 'json',
        data: data
      })
      .done(function() {
        createCover('Inställningar sparade!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#saveWiuSettings').on('click', function() {
      var data = {
        id: $('#id').val(),
        wiuIps: $('#wiuIps').val(),
        wiuEmails: $('#wiuEmails').val(),
        wiuPassword: $('#wiuPassword').val()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/wiuSettings',
        dataType: 'json',
        data: data
      })
      .done(function() {
        createCover('Inställningar sparade!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#generateWiuPassword').on('click', function() {
      var i, password = "";
      for(i=0;i<10;i++) {
        if(Math.floor(Math.random() * 2)) { // Equal chance of number and capital letters!
          password+= Math.floor(Math.random()*10);
        } else {
          password+= String.fromCharCode(Math.floor(Math.random() * 26) + 65);
        }
      }
      $('#wiuPassword').val(password);
    });
    $('#addWiuBlock').on('click', function() {
      var data = {
        id: $('#id').val(),
        url: $('#wiuBlockUrl').val()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/wiuAddBlock',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        createCover('URL '+data.domain+' tillagd!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        console.log(jqXHR);
        if(jqXHR.responseJSON && jqXHR.responseJSON.error === 'Url exists already!') {
          return createCover('URLen existerar redan!', false);
        }
        if(jqXHR.responseJSON && jqXHR.responseJSON.error === 'Url invalid!') {
          return createCover('URLen var felaktig!', false);
        }
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#searchWiuBlock').on('click', function() {
      var data = {
        id: $('#id').val(),
        url: $('#wiuSearchBlockUrl').val()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/wiuSearchBlock',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        var table = '', i, ii;
        for(i = 0, ii = data.urls.length; i < ii; i++) {
          table+= '<tr><td>'+data.urls[i]+'</td><td>ACTION</td></tr>';
        }
        $('#wiuList').children('tbody').html(table);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#settingsArea').children().hide();
    $('#settingsPicker').find('tr').on('click', function() {
      $('#settingsArea').children().hide();
      $($(this).attr('data-target')).show();
    });
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
          $('#password').val('');
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
          createCover('Någonting gick snett. Försök igen lite senare.', false);
          if(console && console.log) {
            console.log(errorThrown);
            console.log(jqXHR);
          }
        });
      }
    });
    $('#saveUserDetails').on('click', function() {
      var data = {};
      $('#userEdit').find('input, select').not('input[type=checkbox]').each(function() {
        data[this.id] = $(this).val();
      });
      $('#userEdit').find('input[type=checkbox]').each(function() {
        data[this.id] = $(this).prop('checked');
      });
      $.ajax({
        method: 'POST',
        url: '/admin/userData',
        dataType: 'json',
        data: data
      })
      .done(function() {
        createCover('Användare sparad!', 2000);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
  }
})(jQuery);
