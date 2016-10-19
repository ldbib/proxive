/* jshint browser: true, node: false, jquery: true */
/* global tinymce */

(function($){
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
  function filterUserList(val) {
    $('#userList').find('tbody').empty();
    if (val === 'locked'){
      for (var i = 0, ii = usersData.length; i < ii; i++){
        if (usersData[i].locked > 0) {
          var row = '<tr id="user-' + usersData[i].id + '"><td>' + usersData[i].fname + '</td><td>' + usersData[i].lname + ' </td><td>' + usersData[i].workplace + '</td><td>';
          row += '<span class="lockedBadge"></span>';
          row += '</td></tr>';
          $('#userList').find('tbody').append(row);
        }
      }
    }
    else {
      var reg = new RegExp(val, "i");
      for (var i = 0, ii = usersData.length; i < ii; i++){
        if (reg.test(usersData[i].fname) || reg.test(usersData[i].lname) || reg.test(usersData[i].workplace)){
          var row = '<tr id="user-' + usersData[i].id + '"><td>' + usersData[i].fname + ' ' + usersData[i].lname + ' </td><td>' + usersData[i].workplace + '</td><td>';
          if (usersData[i].admin > 0){
            row += '<span class="adminBadge"></span>';
          }
          if (usersData[i].locked > 0){
            row += '<span class="lockedBadge"></span>';
          }
          row += '</td></tr>';
          $('#userList').find('tbody').append(row);
        }
      }
    }
  }
  if($('#settingsPicker').length === 1) {
    tinymce.init({
      selector: '#userEmail',
      language: 'sv_SE',
      height: 300,
      content_css : "/css/style.css",
      plugins: [
        'autolink code contextmenu image insertdatetime link table textcolor'
      ],
      toolbar: 'undo redo | styleselect forecolor backcolor | '+
        'bold underline italic | alignleft aligncenter alignright alignjustify | '+
        'bullist numlist outdent indent | link image'
    });
    tinymce.init({
      selector: '#homepageHtml',
      language: 'sv_SE',
      height: 500,
      content_css : "/css/style-tinymce-editor.css",
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
        method: 'GET',
        cache: false,
        url: '/admin/wiuSearchBlock',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        var table = '', i, ii;
        for(i = 0, ii = data.urls.length; i < ii; i++) {
          table+= '<tr><td>'+data.urls[i]+'</td><td><img src=</td></tr>';
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
    // WhiteList
    $('#addWhiteList').on('click', function() {
      var data = {
        url: $('#addWhiteListUrl').val()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/addWhiteList',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        createCover('URL '+data.domain+' tillagd!', 2000);
        $('#addWhiteListUrl').val('');
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
    $('#searchWhiteList').on('click', function() {
      var data = {
        url: $('#searchWhiteListUrl').val()
      };
      $.ajax({
        method: 'GET',
        cache: false,
        url: '/admin/searchWhiteList',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        var table = '', i, ii;
        for(i = 0, ii = data.urls.length; i < ii; i++) {
          table+= '<tr><td>'+data.urls[i].url+'</td><td><span id="'+data.urls[i].id+'" class="removeBadge"></span></td></tr>';
        }
        $('#whiteList').children('tbody').html(table);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
    $('#whiteList').on('click', '.removeBadge', function() {
      var data = {"id": $(this).attr('id')};
      if (confirm('Vill du ta bort '+$(this).closest('td').prev('td').text()+' från vitlistan?')){
        $.ajax({
          method: 'DELETE',
          cache: false,
          url: '/admin/deleteWhiteList',
          dataType: 'json',
          data: data
        })
        .done(function(data) {
          createCover('Borttagen!');
          $('#searchWhiteListUrl').val('');
          $('#whiteList').find('tbody').empty();
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
          createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
          if(console && console.log) {
            console.log(errorThrown);
            console.log(jqXHR);
          }
        });
      }
    })
    $('#homepageType').find('input').on('click', function() {
      var that = $(this);
      setTimeout(function() {
        if(that.val() === 'homepage') {
          $('#homepageEditor').show();
          $('#homepageUrl').hide();
        } else {
          $('#homepageUrl').show();
          $('#homepageEditor').hide();
        }
      }, 1);
    });
    $('#saveHomepageSettings').on('click', function() {
      var data = {
        id: $('#id').val(),
        directToUrl: $('#homepageType').find('input:first').is(':checked') ? 'false' : 'true',
        directUrl: $('#directUrl').val(),
        homepageHtml: tinymce.get('homepageHtml').getContent()
      };
      $.ajax({
        method: 'POST',
        url: '/admin/homepageSettings',
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

    if($('#homepageType').find('input:first').is(':checked')) {
      $('#homepageEditor').show();
      $('#homepageUrl').hide();
    } else {
      $('#homepageUrl').show();
      $('#homepageEditor').hide();
    }
    $('#settingsArea').children().hide();
    $('#settingsPicker').on('click', 'button', function() {
      $('#settingsArea').children().hide();
      $($(this).attr('data-target')).show();
    });
  }
  $('#user-search-btn').on('click', function(){
    var search = $('#user-search').val().trim();
    if (search.length > 0){
      filterUserList(search);
      $(window).resize();
    }
  });
  $('#user-show-locked-btn').on('click', function(){
    var search = 'locked';
    filterUserList(search);
    $(window).resize();
  });
  $('#user-clear-search-btn').on('click', function(){
    $('#user-search').val('');
    $('#userList').find('tbody').empty();
    for (var i = 0, ii = usersData.length; i < ii; i++){
      var row = '<tr id="user-' + usersData[i].id + '"><td>' + usersData[i].fname + ' ' + usersData[i].lname + ' </td><td>' + usersData[i].workplace + '</td><td>';
      if (usersData[i].admin > 0){
        row += '<span class="adminBadge"></span>';
      }
      if (usersData[i].locked > 0){
        row += '<span class="lockedBadge"></span>';
      }
      row += '</td></tr>';
      $('#userList').find('tbody').append(row);
    }
  });
  if($('#userEdit').length === 1) {
    $('#user-new').on('click', function(){
        $('#edit-user').text('Skapa ny användare');
        $('#userEdit').find('input').val('');
        $('#userEdit').find('input[type=checkbox]').prop('checked', false);
        $('#id').val('new');
    });
    $('#userList').on('click', 'tr', function() {
      if(this.id === 'user-new') {
        $('#userEdit').find('input').val('');
        $('#userEdit').find('input[type=checkbox]').prop('checked', false);
        $('#id').val('new');
      } else {
        $('#edit-user').text('Redigera användare');
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
              if(!data[key]) {
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
      data.admin = $('#userEdit').find('input[name=admin]').prop('checked') ? 1 : 0;
      data.locked = $('#userEdit').find('input[name=locked]').prop('checked') ? 1 : 0;
      $.ajax({
        method: 'POST',
        url: '/admin/userData',
        dataType: 'json',
        data: data
      })
      .done(function() {
        if($('#id').val() === 'new') {
          createCover('Användare skapad! Laddar om sidan!', 2000);
          setTimeout(function() {
            window.location = window.location;
          }, 2200);
        } else {
          createCover('Användare sparad! Laddar om sidan!', 2000);
          setTimeout(function() {
            window.location = window.location;
          }, 2200);
        }
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
  $('#deleteUser').on('click', function(){
    var data = {"id": $('#id').val()};
    if (confirm('Vill du ta bort '+ $('#fname').val()+' '+$('#lname').val()+'?')){
      $.ajax({
        method: 'DELETE',
        cache: false,
        url: '/admin/deleteUser',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        createCover('Borttagen! Laddar om sidan!', 2000);
        setTimeout(function() {
          window.location = window.location;
        }, 2200);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare. Prova att ladda om sidan.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    }
  })
  $('#sendUserApprovedEmail').on('click', function(){
      var data = {};
      data.organization = $('#organizationId').val();
      data.email =  $('#email').val();
	  data.pemail = $('#pemail').val();
      $.ajax({
        method: 'POST',
        url: '/admin/sendUserApprovedEmail',
        dataType: 'json',
        data: data
      })
      .done(function(data) {
        createCover('Mail om godkänd användare skickat!', false);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        createCover('Någonting gick snett. Försök igen lite senare.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
  });
  if($('#logFilter').length === 1) {
    $('#logFilterUser').on('click', function() {
      $.ajax({
        method: 'GET',
        url: '/admin/logs',
        dataType: 'json',
        data: {
          search: $('#logFilterUserText').val()
        }
      })
      .done(function(data) {
        var html = '', i, ii;
        for(i = 0, ii = data.logs.length; i < ii; i++) {
          var d = new Date(data.logs[i].unix * 1000);
          var month = d.getMonth() + 1;
          d = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds(); 
          html+= '<tr><td>'+data.logs[i].username+'</td><td>'+data.logs[i].message+'</td><td>'+data.logs[i].os+'</td><td>'+data.logs[i].ua+'</td><td>'+d+'</td></tr>';
        }
        $('#logs').find('tbody').html(html);
      })
      .fail(function(jqXHR, textStatus, errorThrown) {
        if(jqXHR.responseJSON && jqXHR.responseJSON.error === 'Invalid input!') {
          return createCover('Du måste söka på något!', false);
        }
        createCover('Någonting gick snett. Försök igen lite senare.', false);
        if(console && console.log) {
          console.log(errorThrown);
          console.log(jqXHR);
        }
      });
    });
  }
  $('#log1000posts').on('click', function(){
    $.ajax({
      method: 'GET',
      url: '/admin/logs',
      dataType: 'json',
      data: {
        latest: true
      }
    })
    .done(function(data) {
      var html = '', i, ii;
      for(i = 0, ii = data.logs.length; i < ii; i++) {
        var d = new Date(data.logs[i].unix * 1000);
        var month = d.getMonth() + 1;
        d = d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + d.getHours() + ':' + d.getMinutes() + ':' + d.getSeconds(); 
        html+= '<tr><td>'+data.logs[i].username+'</td><td>'+data.logs[i].message+'</td><td>'+data.logs[i].os+'</td><td>'+data.logs[i].ua+'</td><td>'+d+'</td></tr>';
      }
      $('#logs').find('tbody').html(html);
    })
    .fail(function(jqXHR, textStatus, errorThrown) {
      createCover('Någonting gick snett. Försök igen lite senare.', false);
      if(console && console.log) {
        console.log(errorThrown);
        console.log(jqXHR);
      }
    });
  });
})(jQuery);
