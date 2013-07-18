// Run as soon as the document's DOM is ready.
var bkg = chrome.extension.getBackgroundPage();

document.addEventListener('DOMContentLoaded', function () {
  bkg.console.log("loaded UProxy DOM");
  bkg.clearPopupListeners();
  var input = document.getElementById('msg_input');
  input.onkeydown = function(evt) {
    if (evt.keyCode == 13) {
      var text = input.value;
      input.value = "";
      bkg.freedom.emit('send-message', text);
    }
  };

  bkg.addPopupListener('message-update', function(msg) {
    var msg_log = document.getElementById('msg_log');
    msg_log.appendChild(document.createTextNode(msg));
    msg_log.appendChild(document.createElement('br'));
  });

  bkg.freedom.emit('open-popup', '');
});

