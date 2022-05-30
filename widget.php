<?php
/**
 * Valeriy Bodyagin
 * 2019
 */

use Helpers\Curl;
use Helpers\Route;


class Widget extends \Helpers\Widgets{

    private $my_account = '';

    protected function endpoint_digital_pipeline() {
      $this->my_account = Route::get('account');
      $event = Route::param('event');
      $action = Route::param('action');
      $widget_settings = $this->account->current('widget');
      $api_key = $widget_settings['api_key'];
      $list_id = !empty($action['settings']['widget']['settings']['list']) ? $action['settings']['widget']['settings']['list'] : false;
      $all_contacts = (isset($action['settings']['widget']['settings']['all_contacts']) and $action['settings']['widget']['settings']['all_contacts']==1) ? true : false;
      $lead_id = !empty($event['data']['id']) ? $event['data']['id'] : false;
      if (empty($api_key) || empty($list_id) || empty($lead_id))
        return;

      $contacts = $this->get_contacts_from_lead($lead_id, $all_contacts);
      if (empty($contacts['contacts']) and empty($contacts['companies']))
        return;

      $data = $this->get_data_from_contacts($contacts);
      if (empty($data))
        return;

      $url = 'https://api.unisender.com/ru/api/importContacts';
      $uniData = [
        'format' => 'json',
        'api_key' => $api_key,
        'platform' => 'amocrmpro',
        'field_names[0]' => 'Name',
        'field_names[1]' => 'email',
        'field_names[2]' => 'phone',
        'field_names[3]' => 'email_list_ids',
        'field_names[4]' => 'phone_list_ids'
      ];
      foreach ($data as $k => $item) {
        $uniData["data[$k][0]"] = $item['name'];
        $uniData["data[$k][1]"] = !empty($item['email']) ? $item['email'] : "";
        $uniData["data[$k][2]"] = !empty($item['phone']) ? $item['phone'] : "";
        $uniData["data[$k][3]"] = $list_id;
        $uniData["data[$k][4]"] = $list_id;
      }
      $res = Curl::init($url, $uniData, false);

      $uniListName = $this->get_uni_list_name($list_id, $api_key);
      $created_at = time();
      $notes['add'] = array();
      $notes['add'][] = array(
        'element_id' => $lead_id,
        'element_type' => 2,  // lead
        'note_type' => 25,
        'created_at' => $created_at,
        'params' => array(
          'text' => 'Импорт контактов в список рассылок "'.$uniListName.'" завершён',
          'service' => 'UniSender'
        )
      );
      if (!empty($res['result']['log'])) {
        foreach ($res['result']['log'] as $item)
          $notes['add'][] = array(
            'element_id' => $lead_id,
            'element_type' => 2,  // lead
            'note_type' => 25,
            'created_at' => $created_at+5,
            'params' => array(
              'text' => $item['message'],
              'service' => 'UniSender'
            )
          );
      }
      $url = 'https://'.$this->my_account.'.amocrm.ru/api/v2/notes';
      Curl::init($url, $notes, true);
      return true;
    }


    private function get_contacts_from_lead($lead_id, $all_contacts){
      $contacts_ids = array('contacts'=>array(), 'companies'=>array());
      if ($all_contacts==false) {
        $lead = $this->leads->get(['id'=>$lead_id]);
        if (!empty($lead[0]['main_contact_id']))
          $contacts_ids['contacts'][] = $lead[0]['main_contact_id'];
      }
      else {
        $url = 'https://'.$this->my_account.'.amocrm.ru/api/v2/leads?id='.$lead_id;
        $res = Curl::init($url, false, true);
        if (!empty($res['_embedded']['items'][0]['contacts']['id'])) {
          foreach ($res['_embedded']['items'][0]['contacts']['id'] as $contact_id)
            $contacts_ids['contacts'][] = $contact_id;
        }
        if (!empty($res['_embedded']['items'][0]['company']['id']))
          $contacts_ids['companies'][] = $res['_embedded']['items'][0]['company']['id'];
      }
      return $contacts_ids;
    }


    private function get_data_from_contacts($contacts) {
      $data = array();
      if (!empty($contacts['contacts'])) {
        $contacts_data = $this->contacts->get(['id'=>$contacts['contacts']]);
        if (!empty($contacts_data)) {
          foreach ($contacts_data as $item) {
            $contact['id'] = $item['id'];
            $contact['name'] = !empty($item['name']) ? $item['name'] : '';
            foreach ($item['custom_fields'] as $field) {
              if (isset($field['code']) and $field['code']=='EMAIL')
                $contact['email'] = $field['values'][0]['value'];
              elseif (isset($field['code']) and $field['code']=='PHONE')
                $contact['phone'] = $field['values'][0]['value'];
            }
            if (!empty($contact['email']) or !empty($contact['phone']))
              $data[] = $contact;
          }
        }
      }
      if (!empty($contacts['companies'])) {
        $companies_data = $this->company->get(['id'=>$contacts['companies']]);
        if (!empty($companies_data)) {
          foreach ($companies_data as $item) {
            $company['id'] = $item['id'];
            $company['name'] = !empty($item['name']) ? $item['name'] : '';
            foreach ($item['custom_fields'] as $field) {
              if (isset($field['code']) and $field['code']=='EMAIL')
                $company['email'] = $field['values'][0]['value'];
              elseif (isset($field['code']) and $field['code']=='PHONE')
                $company['phone'] = $field['values'][0]['value'];
            }
            if (!empty($company['email']) or !empty($company['phone']))
              $data[] = $company;
          }
        }
      }
      return $data;
    }


    private function get_uni_list_name($list_id, $api_key){
        $url = 'https://api.unisender.com/ru/api/getLists';
        $data = array(
            'format' => 'json',
            'api_key' => $api_key,
            'platform' => 'amocrmpro',
        );
        $list = Curl::init($url, $data, false);

        if(!is_array($list['result'])) return '';

        foreach ($list['result'] as $item){
            if ($item['id'] == $list_id) return $item['title'];
        }

        return '';
    }


    private function write_log($title, $data) {
      $post[$title] = $data;
      $url = 'http://test.d-server.antalika.com';
      Curl::init($url, $post, false);  // 3-ий параметр - использовать куки или нет
    }

}
