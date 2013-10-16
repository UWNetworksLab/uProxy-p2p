function onload() {
  console.log('Starting XMPP authentication dialog');
  var recvForm = document.getElementById('login-form');
  recvForm.onsubmit = formSubmit;
}

function formSubmit() {
  var userField = document.getElementById('username');
  var passwordField = document.getElementById('password');
  var credentials = {}
  this.credentials.userId = userField.value;
  this.credentials.token = passwordField.value;
  console.log(JSON.stringify(credentials));
}

window.addEventListener('load', onload, false); 
