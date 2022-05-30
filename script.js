/**
 * Valeriy Bodyagin
 * 2019
 */

define(['jquery', 'lib/components/base/modal', 'underscore'], function($, Modal, _){
  var templates = {
      main: {
          body: _.template(
              '<link type="text/css" rel="stylesheet" href="<%= path %>/style.css" >\
              <div class="unisender_body_wrap">\
                  <h3>Экспорт в UniSender</h3>\
                  <h4>Выберите списки рассылок, в которые необходимо экспортировать выбранные контакты:</h4>\
                  <p>\
                      <ul class="unisender_sections" multiple></ul>\
                  </p>\
                  <div class="unisender_transfer_fields">\
                    Передать: <br />\
                    <input type="radio" name="transfer_fields" value="all" checked /> Email и телефон <br />\
                    <input type="radio" name="transfer_fields" value="email" /> Только email <br />\
                    <input type="radio" name="transfer_fields" value="phone" /> Только телефон <br />\
                  </div>\
                  <div class="unisender_custom_fields" style="display:none;">\
                      <p>Можно выбрать дополнительные поля для экспорта:</p>\
                      <div class="custom_fields_block">\
                          <p class="u-label">amoCRM:</p>\
                          <select class="amo_field"></select>\
                          <p class="u-label" style="margin-top:5px">UniSender:</p>\
                          <select class="uni_field"></select>\
                      </div>\
                      <div id="unisender_add_field"></div>\
                  </div>\
                  <div class="unisender_info"></div>\
                  <div class="errors" style="display:none;"></div>\
                  <p>\
                      <button type="button" class="button-input button-input_uni" id="unisender_export_btn">\
                          <span class="button-input-inner ">Экспортировать</span>\
                      </button><br />\
                      <button type="button" class="button-input button-unsubscrube_uni" id="unisender_unsubscrube_btn">\
                          <span class="button-input-inner ">Отписать</span>\
                      </button><br />\
                      <button type="button" class="button-input button-cancel">\
                          <span>Отмена</span>\
                      </button>\
                  </p>\
              </div>')
        },
        elements: {
          option: _.template('<option value="<%= value %>"><%= title %></option>'),
          li: _.template('<li data-id="<%= value %>"><%= title %></li>'),
        }
    };


    var UnisenderWidget = function () {
      var self = this,
        system = self.system,
        wSettings = null,
        lists = [],
        ids = {
          contacts: [],
          companies: [],
          leads: []
        };

      var helpers = {
          isCurrentPageContactsAndCompanies: function () {
              var path = window.location.pathname;
              return path == '/contacts/list/';
          },

          isCurrentPageContacts: function () {
            var path = window.location.pathname;
            return path.includes('/contacts/list/contacts/');
          },

          isCurrentPageCompanies: function () {
            var path = window.location.pathname;
            return path.includes('/contacts/list/companies/');
          },

          getDetailPageId: function (){
              var path = window.location.pathname;
              return path.match(/(contacts|companies|leads)\/detail\/(\d+)/);
          },

          getContactsIds: function(contacts){
            var items = {
              contacts: [],
              companies: [],
              leads: []
            };
            contacts.forEach(function(item, i, arr) {
              if(item.type == 'contact')
                items.contacts.push(item.id);
              else if(item.type == 'company')
                items.companies.push(item.id);
              else if(item.type == 'lead')
                items.leads.push(item.id);
            });
            $('.unisender_body_wrap .unisender_info').text('Выбрано ' + contacts.length + ' конт.');
            return items;
          },
  
          getIdsUriParams: function (items) {
              if(items.length == 0) return '';
              return 'id[]=' + items.join('&id[]=');
          },
  
          initFieldsSelect: function(selector, items) {
              var select = $(selector);
              select.empty();
              select.append('<option value="0" selected>нет</option>');
              items.forEach(function (item, i, items) {
                  select.append('<option value="' + item.id + '" >' + item.name + '</option>');
              })
          },
  
          getSectionsSelected: function() {
              var el = $('.unisender_sections'),
                  res = [];
  
              el.find('li.active').each(function () {
                  res.push($(this).data('id'));
              });
  
              return res;
          },
  
          getSectionsSelectedNames: function() {
              var el = $('.unisender_sections'),
                  res = [];
  
              el.find('li.active').each(function () {
                  res.push($(this).text());
              });
  
              return '"' + res.join('", "') + '"';
          },
  
          hasSectionsSelected: function (mess) {
            var sections = this.getSectionsSelected(),
              el = $('.unisender_sections');
  
            if(sections.length == 0){
              el.css('border-color', 'red');
              showMessage(mess);
              return false;
            }else{
              el.css('border-color', '#aaaaaa');
            }
            return true;
          },

          getSelectedCustomFieldValue: function(itemCustomFields){
              var selectedCustomField = $('select.amo_field').val();

              if (itemCustomFields.length == 0 || selectedCustomField == 0) return;

              for(var k = 0; k < itemCustomFields.length; k++){
                  if(itemCustomFields[k].id == selectedCustomField){
                      return itemCustomFields[k].values[0].value;
                  }
              }
              return '';
          },
          
          prepareContactsData: function (items, contacts_type){
            var res = [];
            if(items.length == 0) return res;
        
            items.forEach(function (item, i, items) {
              var contact = {
                id: item.id,
                name: (item.name=='Имя не указано') ? '' : item.name,
                type: contacts_type,
                phone: '',
                email: '',
                custom_fields: []
              };
      
              for (var k=0; k<item.custom_fields.length; k++) {
                if (item.custom_fields[k].name == 'Телефон')
                  contact.phone = item.custom_fields[k].values[0].value;
                else if (item.custom_fields[k].name == 'Email')
                  contact.email = item.custom_fields[k].values[0].value;
              }
              if (contact.phone.length>0 || contact.email.length>0) {
                for (i=0; i<$('.custom_fields_block').length; i++) {
                  amo_id = $('select.amo_field').eq(i).val();
                  uni_name = $('select.uni_field').eq(i).val();
                  if (uni_name!=null && uni_name!='0') {
                    for (var k=0; k<item.custom_fields.length; k++) {
                      if (item.custom_fields[k].id == amo_id)
                        contact.custom_fields[i] = item.custom_fields[k].values[0].value;
                    }
                    if (contact.custom_fields[i]==undefined)
                      contact.custom_fields[i] = '';
                  }
                }
                
                res.push(contact);
              }
            });
                            
            return res;
          },
          
          createExportParams: function(contacts, sections) {
              var res = '',
                fields = ['Name', 'email_list_ids', 'phone_list_ids'],
                values = [],
                transfer_fields = $("input[name='transfer_fields']:checked").val();
                
              if(contacts.length == 0 || sections.length == 0) return res;
              
              res = 'format=json&api_key='+wSettings.api_key+'&platform=amocrmpro';
              
              if (transfer_fields=='email')
                fields.push('email');
              else if (transfer_fields=='phone')
                fields.push('phone');
              else {
                fields.push('email');
                fields.push('phone');
              }
              for (i=0; i<$('.custom_fields_block').length; i++) {
                uni_name = $('select.uni_field').eq(i).val();
                if (uni_name!=null && uni_name!='0')
                  fields.push(uni_name);
              }
              for (i=0; i<fields.length; i++)
                res = res+'&field_names['+i+']='+fields[i];
                
              var sIds = sections.join(',');
              for (i=0; i<contacts.length; i++) {
                values = [contacts[i].name, sIds, sIds];
                if (transfer_fields=='email')
                  values.push(contacts[i].email);
                else if (transfer_fields=='phone')
                  values.push(contacts[i].phone);
                else {
                  values.push(contacts[i].email);
                  values.push(contacts[i].phone);
                }
                for (j=0; j<contacts[i].custom_fields.length; j++)
                  values.push(contacts[i].custom_fields[j]);
                for (j=0; j<values.length; j++)
                  res = res+'&data['+i+']['+j+']='+values[j];
              }
              
              return res;
          },
          
          createUnsubscribeParams: function(contacts, sections) {
              var res = '',
                fields = ['delete', 'Name', 'email_list_ids', 'phone_list_ids'],
                values = [],
                transfer_fields = $("input[name='transfer_fields']:checked").val();
                
              if (contacts.length == 0 || sections.length == 0) return res;
              
              res = 'format=json&api_key='+wSettings.api_key+'&platform=amocrmpro';
              
              if (transfer_fields=='email')
                fields.push('email');
              else if (transfer_fields=='phone')
                fields.push('phone');
              else {
                fields.push('email');
                fields.push('phone');
              }
              for (i=0; i<fields.length; i++)
                res = res+'&field_names['+i+']='+fields[i];
                
              var sIds = sections.join(',');
              for (i=0; i<contacts.length; i++) {
                values = [1, contacts[i].name, sIds, sIds];
                if (transfer_fields=='email')
                  values.push(contacts[i].email);
                else if (transfer_fields=='phone')
                  values.push(contacts[i].phone);
                else {
                  values.push(contacts[i].email);
                  values.push(contacts[i].phone);
                }
                for (j=0; j<values.length; j++)
                  res = res+'&data['+i+']['+j+']='+values[j];
              }
              
              return res;
          },

          onSelected: function() {
              ids = helpers.getContactsIds(self.list_selected().selected);
              if(ids.contacts.length == 0 && ids.companies.length == 0 && ids.leads.length == 0){
                  showMessage('Отсутствуют данные для экспорта.');
              }
          },

          showErrors: function(log) {
            var message = '',
              phone_errors = [],
              email_errors = [],
              other_errors = [],
              el = $('.unisender_body_wrap .errors');
            if (log.length == 0) return;
    
            log.forEach(function(error, i, log) {
              if (error.message.indexOf('phone number was ignored')!=-1)
                phone_errors.push(error.message);
              else if (error.message.indexOf('email was ignored')!=-1)
                email_errors.push(error.message);
              else
                other_errors.push(error.message);
            });
            
            if (phone_errors.length!=0)
              message += 'Ошибка при передачи номера телефона ('+phone_errors.length+' '+helpers.wordEnding(phone_errors.length, ['ошибка','ошибки','ошибок'])+')<br />';
            if (email_errors.length!=0)
              message += 'Ошибка при передачи email ('+email_errors.length+' '+helpers.wordEnding(email_errors.length, ['ошибка','ошибки','ошибок'])+')<br />';
            if (other_errors.length!=0)
              message += 'Другие ошибки ('+other_errors.length+' '+helpers.wordEnding(other_errors.length, ['ошибка','ошибки','ошибок'])+')<br />';
            
            el.html(message);
            el.show('slow');
            setTimeout(function () {
              el.hide('slow');
            }, 15000);
          },
      
          wordEnding: function(count, expressions) {
            var n = count % 100;
            if (n>=5 && n<=20)
              return expressions[2];
            else {
              n = n % 10;
              if (n==1)
                return expressions[0];
              else if (n>=2 && n<=4)
                return expressions[1];
              else
                return expressions[2];
            }
          }
        
      },
      

      initUnisenderCustomFields = function() {
          self.crm_post(
              'https://api.unisender.com/ru/api/getFields',
              {
                  format: 'json',
                  api_key: wSettings.api_key,
                  platform: 'amocrmpro'
              },
              function (msg) {
                  if(typeof  msg.error !== 'undefined') return;

                  var uList = msg.result,
                      uFields = [];

                  uList.forEach(function (field, i, uList) {
                      if (field.name == 'Name') return;
                      uFields.push({
                          id: field.name,
                          name: field.public_name
                      });
                  })

                  if(uFields.length == 0) return;

                  $.ajax('/api/v2/account',
                      {
                          dataType: 'json',
                          data: {
                              with: 'custom_fields'
                          },
                          method: 'GET'
                      }
                  ).done(function (data) {
                      var list = [],
                        oFields = [];
                      
                      if (helpers.isCurrentPageCompanies())
                        list = Object.values(data._embedded.custom_fields['companies']);
                      else if (helpers.isCurrentPageContactsAndCompanies())
                        list = Object.values(data._embedded.custom_fields['contacts']).concat(Object.values(data._embedded.custom_fields['companies']));
                      else
                        list = Object.values(data._embedded.custom_fields['contacts']);
                      list.forEach(function (field, i, list) {
                          if(!['Email', 'Телефон'].includes(field.name)){
                              oFields.push({
                                  id: field.id,
                                  name: field.name
                              });
                          }
                      })
                      if(oFields.length == 0) return;

                      helpers.initFieldsSelect('select.amo_field', oFields);
                      helpers.initFieldsSelect('select.uni_field', uFields);
                      $('.unisender_custom_fields').show();
                  });
              },
              'json'
          );
      },
      
      exportContactsToUnisender = function(items, contacts_type, sections) {
          if(items.length == 0) return false;
          var url = '',
            contacts = [],
            params = helpers.getIdsUriParams(items),
            message = 'Экспорт ';

          if (contacts_type == 'contact') {
              url = '/api/v2/contacts/';
              message += 'контактов: ';
          }
          else if(contacts_type == 'company') {
              url = '/api/v2/companies/';
              message += 'компаний: ';
          }
          else return false;

          $.ajax(url, {
              dataType: 'json',
              data: params,
              method: 'GET'
          }).done(function(data) {
              contacts = helpers.prepareContactsData(data._embedded.items, contacts_type);
              params = helpers.createExportParams(contacts, sections);
              $.ajax('https://api.unisender.com/ru/api/importContacts',
                  {
                      dataType: 'json',
                      data: params,
                      method: 'POST'
                  }
              ).done(function(data) {
                if (typeof data.error !== 'undefined') {
                  el = $('.unisender_body_wrap .errors');
                  el.html('Передача данных не удалась. Ответ от сервиса unisender.com: '+data.error);
                  el.show('slow');
                  setTimeout(function () {
                    el.hide('slow');
                  }, 15000);
                }
                else {
                  showMessage(message + data.result.total);
                  helpers.showErrors(data.result.log);
                  addAmoNotes(contacts, data.result.log);
                }
              });
          });
      },
      
      exportLeadsToUnisender = function (items, sections){
          if(items.length == 0) return false;

          var url = '/api/v2/leads/',
              contacts = [],
              params = helpers.getIdsUriParams(items),
              customData = [];
          $.ajax(url, {
              dataType: 'json',
              data: params,
              method: 'GET'
          }).done(function (data) {
              data._embedded.items.forEach(function (lead, i, leads) {
                  lead.contacts.id.forEach(function (id, j, list) {
                      contacts.push(id);
                  });
              });
              exportContactsToUnisender(contacts, 'contact', sections);
          });
      },
      
      unsubscribeContactsInUnisender = function(items, contacts_type, sections) {
          if(items.length == 0) return false;
          var url = '',
            contacts = [],
            params = helpers.getIdsUriParams(items),
            message = 'Отписка ';

          if (contacts_type == 'contact') {
              url = '/api/v2/contacts/';
              message += 'контактов: ';
          }
          else if(contacts_type == 'company') {
              url = '/api/v2/companies/';
              message += 'компаний: ';
          }
          else return false;

          $.ajax(url, {
              dataType: 'json',
              data: params,
              method: 'GET'
          }).done(function(data) {
              contacts = helpers.prepareContactsData(data._embedded.items, contacts_type);
              params = helpers.createUnsubscribeParams(contacts, sections);
              $.ajax('https://api.unisender.com/ru/api/importContacts',
                  {
                      dataType: 'json',
                      data: params,
                      method: 'POST'
                  }
              ).done(function(data) {
                showMessage(message + data.result.total);
                addUnsubscribeNotes(contacts, data.result.log);
              });
          });
      },
      
      unsubscribeLeadsInUnisender = function (items, sections){
          if(items.length == 0) return false;

          var url = '/api/v2/leads/',
              contacts = [],
              params = helpers.getIdsUriParams(items),
              customData = [];
          $.ajax(url, {
              dataType: 'json',
              data: params,
              method: 'GET'
          }).done(function (data) {
              data._embedded.items.forEach(function (lead, i, leads) {
                  lead.contacts.id.forEach(function (id, j, list) {
                      contacts.push(id);
                  });
              });
              unsubscribeContactsInUnisender(contacts, 'contact', sections);
          });
      },
      
      addAmoNotes = function(contacts, errors) {
        var notes = {
            add: []
          },
          transfer_fields = $("input[name='transfer_fields']:checked").val(),
          date = new Date,
          listNames = helpers.getSectionsSelectedNames();
          
        contacts.forEach(function(contact, i, contacts) {
          var created_at = Math.round(date.getTime()/1000);
          if (transfer_fields=='email')
            var text = 'Email *-* успешно добавлен в списки рассылок ';
          else if (transfer_fields=='phone')
            var text = 'Телефон *-* успешно добавлен в списки рассылок ';
          else
            var text = 'Email и телефон *-* успешно добавлены в списки рассылок ';
            
          var note = {
            element_id: contact.id,
            element_type: (contact.type=='contact') ? 1 : 3,  // contact : company
            note_type: 25,
            created_at: created_at,
            params: {
              text: (contact.type=='contact') ?
                text.replace('*-*', 'контакта "'+contact.name+'"')+listNames :
                text.replace('*-*', 'компании "'+contact.name+'"')+listNames,
              service: 'UniSender'
            }
          };
          notes.add.push(note);
          
          for (j=0; j<errors.length; j++) {
            if (errors[j].index==i) {
              note = {
                element_id: contact.id,
                element_type: (contact.type=='contact') ? 1 : 3,  // contact : company
                note_type: 25,
                created_at: created_at+5,
                params: {
                  service: 'UniSender',
                  text: errors[j].message
                }
              };
              notes.add.push(note);
            }
          }
        });
        
        $.ajax('/api/v2/notes', {
          dataType: 'json',
          data: notes,
          method: 'POST'
        });
      },
      
      addUnsubscribeNotes = function(contacts, errors) {
        var notes = {
            add: []
          },
          transfer_fields = $("input[name='transfer_fields']:checked").val(),
          listNames = helpers.getSectionsSelectedNames(),
          has_error = false;
          
        contacts.forEach(function(contact, i, contacts) {
          has_error = false;
          for (j=0; j<errors.length; j++) {
            if (errors[j].index==i)
              has_error = true;
          }
          if (has_error==false) {
            var note = {
              element_id: contact.id,
              element_type: (contact.type=='contact') ? 1 : 3,  // contact : company
              note_type: 25,
              params: {
                text: (contact.type=='contact') ?
                  'Контакт "'+contact.name+'" успешно отписан из списков рассылок '+listNames :
                  'Компания "'+contact.name+'" успешно отписана из списков рассылок '+listNames,
                service: 'UniSender'
              }
            };
            notes.add.push(note);
          }
        });
        
        $.ajax('/api/v2/notes', {
          dataType: 'json',
          data: notes,
          method: 'POST'
        });
      },
      
      showMessage = function (text) {
          var message = {
              header: 'UniSender',
              text: text,
              date: Math.ceil(Date.now()/1000),
              icon: wSettings.path + '/images/logo_min.png'
          };
          AMOCRM.notifications.show_message(message);
      };

    this.callbacks = {
      render: function(){
        wSettings = self.get_settings();
        var img1 = new Image(), img2 = new Image();
        img1.src = wSettings.path+'/images/chbox.png';
        img2.src = wSettings.path+'/images/chbox_active.png';
        self.render_template(
            {
                caption:{
                    class_name: 'unisender_v02_widget_caption',
                },
                body: '',
                render : templates.main.body({
                    path: wSettings.path,
                    code: wSettings.widget_code
                })
            }
        );
        return true;
      },
      
      init: function(){
          $('.unisender_v02_widget_caption .card-widgets__widget__caption__logo').attr('src', wSettings.path + '/images/logo_text.png');
          self.crm_post(
              'https://api.unisender.com/ru/api/getLists',
              {
                  format: 'json',
                  api_key: wSettings.api_key,
                  platform: 'amocrmpro'
              },
              function (msg) {
                  if(typeof  msg.result !== 'undefined'){
                    lists = msg.result;
                      lists.forEach(function (item, i, items) {
                          $('ul.unisender_sections').append(templates.elements.li({
                                  value: item.id,
                                  title: item.title
                              })
                          );
                      })
                  }
              },
              'json'
          );
          initUnisenderCustomFields();
          return true;
      },
      
      bind_actions: function(){
          $('#unisender_export_btn').bind('click', function(){
            if(!helpers.hasSectionsSelected(self.i18n('errors').not_section_selected)) return;

            var sections = helpers.getSectionsSelected();
            var type = helpers.getDetailPageId();
            if(!_.isNull(type)) ids[type[1]] = [type[2]];

            exportContactsToUnisender(ids.contacts, 'contact', sections);
            exportContactsToUnisender(ids.companies, 'company', sections);
            exportLeadsToUnisender(ids.leads, sections);
            
            $('.unisender_body_wrap .unisender_info').text('Контакты переданы');
            setTimeout(function () {
                $('.unisender_body_wrap .unisender_info').text('');
            }, 3000);
          });
          
          $('#unisender_unsubscrube_btn').bind('click', function(){
            if(!helpers.hasSectionsSelected(self.i18n('errors').not_section_selected)) return;

            var sections = helpers.getSectionsSelected();
            var type = helpers.getDetailPageId();
            if(!_.isNull(type)) ids[type[1]] = [type[2]];

            unsubscribeContactsInUnisender(ids.contacts, 'contact', sections);
            unsubscribeContactsInUnisender(ids.companies, 'company', sections);
            unsubscribeLeadsInUnisender(ids.leads, sections);
            
            $('.unisender_body_wrap .unisender_info').text('Контакты отписаны');
            setTimeout(function () {
                $('.unisender_body_wrap .unisender_info').text('');
            }, 3000);
          });
          
          $('.button-input.button-cancel').bind('click', function(){
            self.widgetsOverlay(false);
          });
          
          $('.unisender_sections').bind('click', function(){
            $('.unisender_sections').css('border-color', '#aaaaaa');
          });
          
          $('.card-widgets__widget-' + wSettings.widget_code).on('click', 'ul.unisender_sections li', function () {
              if ($(this).hasClass('active'))
                  $(this).removeClass('active');
              else
                  $(this).addClass('active');
          });
          
          $('.modal-body__close').bind('click', function(){
            $('#widgets_block').hide();
            $('#card_widgets_overlay').remove();
          });
          
          $('#unisender_add_field').bind('click', function(){
            var custom_fields_block = $('.custom_fields_block').clone().first();
            custom_fields_block.insertBefore(this);
            var n1 = custom_fields_block.find('select.amo_field option').length - 1;
            var n2 = custom_fields_block.find('select.uni_field option').length - 1;
            var n = (n1<n2) ? n1 : n2;
            var col_fields_blocks = $('.custom_fields_block').length;
            if (col_fields_blocks==n)
              $('#unisender_add_field').hide();
          });

          return true;
      },
      
      settings: function(){
        var checked = $('.widget-state__name').text()=='install' ? '' : 'checked="checked"';
        $('#widget_settings__fields_wrapper').prepend('<div class="widget_settings_block__input_field"><label><input type="checkbox" name="agreement" value="1" '+checked+'>&nbsp;&nbsp;' + self.i18n('settings').agreement +'</label></div>');
        return true;
      },
      
      onSave: function(){
        var turn_on = $('#widget_settings__fields_wrapper input[name=widget_active]').val(),
          wId = $('#save_' + wSettings.widget_code).data('id'),
          agreement = $('#widget_settings__fields_wrapper input[name=agreement]:checked').val();
          
        if (turn_on=='Y') {
          if (typeof agreement === 'undefined') {
            if ($('#widget_settings__fields_wrapper .agreement_error').length==0)
              $('#widget_settings__fields_wrapper').append('<div class="agreement_error" style="color:red; padding:5px;">' + self.i18n('errors').need_agreement + '</div>');
            return false;
          }
          else
            $('.agreement_error').remove();
  
          self.crm_post(
            'https://api.unisender.com/ru/api/getLists',
            {
              format: 'json',
              api_key: $('#widget_settings__fields_wrapper input[name=api_key]').val(),
              platform: 'amocrmpro'
            },
            function (msg) {
              if(typeof  msg.error !== 'undefined') {
                $.ajax('/ajax/widgets/edit', {
                  dataType: 'json',
                  data: {
                    action: 'edit',
                    id: wId,
                    code: wSettings.widget_code,
                    widget_active: false
                  },
                  method: 'POST'
                }).done(function(data) {
                  showMessage(self.i18n('errors').api_key_incorrect);
                  self.set_status('error');
                });
              }
            },
            'json'
          );
        }

        return true;
      },
      
      dpSettings: function(){
        var w_code = self.get_settings().widget_code,
          form = $(".digital-pipeline__short-task_widget-style_"+w_code).closest('.digital-pipeline__item-inner').find('form.digital-pipeline__edit-forms'),
          checked1 = '',
          checked2 = '';
        
        form.find('input[name=list]').attr('type', 'hidden');
        form.find('input[name=list]').closest('div.widget_settings_block__input_field')
          .append('<select style="border:solid 1px #D4D5D8"></select>');
        form.find('input[name=all_contacts]').attr('type', 'hidden');
        if (form.find('input[name=all_contacts]').val()=='1')
          checked2 = 'checked';
        else
          checked1 = 'checked';
        form.find('input[name=all_contacts]').closest('div.widget_settings_block__input_field')
          .append('<input type="radio" name="r_all_contacts" value="0" '+checked1+' /> только главный контакт <br />');
        form.find('input[name=all_contacts]').closest('div.widget_settings_block__input_field')
          .append('<input type="radio" name="r_all_contacts" value="1" '+checked2+' /> все контакты');
        
        self.crm_post(
          'https://api.unisender.com/ru/api/getLists',
          {
            format: 'json',
            api_key: wSettings.api_key,
            platform: 'amocrmpro'
          },
          function (msg) {
            if(typeof  msg.result !== 'undefined'){
              lists = msg.result;
              lists.forEach(function (item, i, items) {
                form.find('select').append(templates.elements.option({
                    value: item.id,
                    title: item.title
                  })
                );
              });
              if (form.find('input[name=list]').val() == undefined)
                form.find('input[name=list]').val(form.find('select').val());
              else
                form.find('select').val(form.find('input[name=list]').val());
            }
          },
          'json'
        );
        
        $(form).on('change', 'select', function(event) {
          form.find('input[name=list]').val($(this).val());
          $('form.digital-pipeline__edit-forms button.button-input-disabled').addClass('button-input_blue').removeClass('button-input-disabled');
          event.stopPropagation();
        });
        $(form).on('click', 'input[name=r_all_contacts]', function() {
          form.find('input[name=all_contacts]').val($(this).val());
        });
        
        return true;
      },
      
      contacts: {
          selected: function(){
              helpers.onSelected();
          }
      },
        
      leads: {
          selected: function(){
              helpers.onSelected();
          }
      }
    };
    return this;
  };

  return UnisenderWidget;
});
