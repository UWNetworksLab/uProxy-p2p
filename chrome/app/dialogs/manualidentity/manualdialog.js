var FREEDOM_CHROME_APP_ID = 'hilnpmepiebcjhibkbkfkjkacnnclkmi';
var port = null;
var msgCount = 0;

function onload() {
  console.log('Starting manual dialog');
  port = chrome.runtime.connect(FREEDOM_CHROME_APP_ID, {name: 'manualdialog'});
  port.onDisconnect.addListener(onDisconnect);
  port.onMessage.addListener(onMessage);
  var recvForm = document.getElementById('recv-form');
  recvForm.onsubmit = receiveMessage;
}

function onDisconnect() {
  console.log('Port to Chrome app disconnected');
  port = null;
};

function receiveMessage() {
  var recvInput = document.getElementById('recv-input');
  var msg = recvInput.value;
  recvInput.value = '';
  console.log(msg);
  if (port) {
    port.postMessage(msg);
  } else {
    console.error("Chrome app port not ready yet for message: "+msg);
  }
}

function removeId(id) {
  var elt = document.getElementById('send-table');
  elt.removeChild(document.getElementById(id));
}

function onMessage(args) {
  if (args && args.cmd && args.to && args.msg && args.cmd == 'manual-send') {
    var row = document.createElement('tr');
    row.id = 'msg'+(++msgCount);
    var to = args.to;
    if (to.indexOf('manual://') >= 0) {
      to = to.substr(to.indexOf('manual://') + 9);
    }
    row.appendChild(
      document.createElement('td').appendChild(
        document.createTextNode(to)
      ).parentNode
    );
    var msgInput = document.createElement('input');
    msgInput.text = "text";
    msgInput.className = "input-large";
    msgInput.value = args.msg;
    row.appendChild(document.createElement('td').appendChild(msgInput).parentNode);
    var btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.onclick = (function(id) {removeId(id)}).bind(this, row.id);
    btn.appendChild(document.createTextNode('Done'));
    row.appendChild(document.createElement('td').appendChild(btn).parentNode);
    
    document.getElementById('send-table').appendChild(row);

  } else if (args && args.cmd && args.cmd == 'manual-recv') {
    console.log('Receive triggered');
  } else {
    console.log('Msg missing fields: ' + JSON.stringify(args));
  }
}

window.addEventListener('load', onload, false); 
