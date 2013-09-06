/*
 * Copyright 2011 Google Inc. All Rights Reserved.

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var google = new OAuth2('google', {
  client_id: '952993494713-h12m6utvq8g8d8et8n2i68plbrr6cr4d.apps.googleusercontent.com',
  client_secret: 'IZ4hBSbosuhoWAX4lyAomm-R',
  api_scope: 'https://www.googleapis.com/auth/tasks'
});

google.authorize(function() {

  var TASK_CREATE_URL = 'https://www.googleapis.com/tasks/v1/lists/@default/tasks';

  var form = document.getElementById('form');
  var success = document.getElementById('success');

  // Hook up the form to create a new task with Google Tasks
  form.addEventListener('submit', function(event) {
    event.preventDefault();
    var input = document.getElementById('input');
    createTodo(input.value);
  });

  function createTodo(task) {
    // Make an XHR that creates the task
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function(event) {
      if (xhr.readyState == 4) {
        if(xhr.status == 200) {
          // Great success: parse response with JSON
          var task = JSON.parse(xhr.responseText);
          document.getElementById('taskid').innerHTML = task.id;
          form.style.display = 'none';
          success.style.display = 'block';

        } else {
          // Request failure: something bad happened
        }
      }
    };

    var message = JSON.stringify({
      title: task
    });

    xhr.open('POST', TASK_CREATE_URL, true);

    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'OAuth ' + google.getAccessToken());

    xhr.send(message);
  }

});

