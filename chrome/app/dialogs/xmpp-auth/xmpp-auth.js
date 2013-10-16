var CREDENTIALS_KEY = "xmpp-credentials-mvav24n24ovp48"

function onload() {
  console.log('Starting XMPP authentication dialog');
  var recvForm = document.getElementById('login-form');
  recvForm.onsubmit = formSubmit;
}

function formSubmit() {
  var userField = document.getElementById('username');
  var passwordField = document.getElementById('password');
  var credentials = {}
  credentials.userId = userField.value;
  credentials.token = passwordField.value;
  var items = {};
  items[CREDENTIALS_KEY] = credentials;
  //@todo remove plaintext! 
  chrome.storage.local.set(items);
  chrome.app.window.current().close();
}

window.addEventListener('load', onload, false); 
