var tcpServer;
var chatClient;
var activeJID = "";

var activeConnections = [];
var activeSockets = [];
var activeBuffer = [];

function handleClientAccept(client) {
	var proxy = new Socks5Proxy(client);
  proxy._setXmppSender(function(jsondata) {
    console.log(jsondata);
    chatClient.sendMessage(activeJID, jsondata);
  });
  activeConnections[proxy.xmppid] = proxy;
};

function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function abtob64(arraybuffer) {
  return btoa(String.fromCharCode.apply(null, new Uint8Array(arraybuffer)));
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bytes = new Uint8Array(arraybuffer),
    i, len = bytes.buffer.byteLength, base64 = "";

    for (i = 0; i < len; i+=3) {
      base64 += chars[bytes.buffer[i] >> 2];
      base64 += chars[((bytes.buffer[i] & 3) << 4) | (bytes.buffer[i + 1] >> 4)];
      base64 += chars[((bytes.buffer[i + 1] & 15) << 2) | (bytes.buffer[i + 2] >> 6)];
      base64 += chars[bytes.buffer[i + 2] & 63];
    }

    if ((len % 3) === 2) {
      base64 = base64.substring(0, base64.length - 1) + "=";
    } else if (len % 3 === 1) {
      base64 = base64.substring(0, base64.length - 2) + "==";
    }

    return base64;
};

function b64toab(base64) {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    var bufferLength = base64.length * 0.75,
    len = base64.length, i, p = 0,
    encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === "=") {
      bufferLength--;
      if (base64[base64.length - 2] === "=") {
        bufferLength--;
      }
    }

    var arraybuffer = new ArrayBuffer(bufferLength),
    bytes = new Uint8Array(arraybuffer);

    for (i = 0; i < len; i+=4) {
      encoded1 = chars.indexOf(base64[i]);
      encoded2 = chars.indexOf(base64[i+1]);
      encoded3 = chars.indexOf(base64[i+2]);
      encoded4 = chars.indexOf(base64[i+3]);

      bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
      bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
      bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arraybuffer;
};


function startup() {
  // Local Proxy
  tcpServer = new TcpServer("127.0.0.1", 8123);
  tcpServer.listen(handleClientAccept);

  // Auth Flow.
  var creds = {};
  var start = document.createElement("button");
  start.innerHTML = "Log In!";
  start.addEventListener('click', function() {
    getCredentials(function(cred) {
      creds = cred;
      console.log(cred);
    });
  }, true);
  document.body.appendChild(start);

  var status = document.createElement("div");
  status.innerHTML = "No active friend connection.";
  var roster = document.createElement("div");
  var rosterPrinter = function(r) {
    roster.innerHTML = "";
    roster.appendChild(document.createTextNode("Available Friends:"));
    for (var i = 0; i < r.length; i++) {
      var child = document.createElement('div');
      child.innerHTML = r[i];
      child.addEventListener('click', function(jid) {
        activeJID = jid;
        console.log("Messages will be sent to: " + activeJID);
        status.innerText = "Active connection to " + activeJID;
      }.bind(this, r[i]), true);
      roster.appendChild(child);
    }
  }
  
  var streamListener = function(from, data) {
    console.log(data);
    if (!(data.hasOwnProperty('command') && data.hasOwnProperty('id'))) {
      console.log('Missing either command or id');
    } else if (data['command'] == 'open') {
      chrome.socket.create('tcp', {}, function(sockInfo) {
        chrome.socket.connect(sockInfo.socketId, data.host, data.port, function(result) {
          activeSockets[data['id']] = sockInfo.socketId;
          var socketRead = function(readInfo) {
            if (readInfo.resultCode > 0) {
              chatClient.sendMessage(from, {id: data['id'], command: "receive", data: abtob64(readInfo.data)});
            }
            chrome.socket.read(sockInfo.socketId, socketRead);
          }
          chrome.socket.read(sockInfo.socketId, socketRead);
          if (activeBuffer.hasOwnProperty(data['id'])) {
            chrome.socket.write(activeSockets[data['id']], activeBuffer[data['id']], function(writeInfo) {
              console.log(writeInfo);
            });
            delete activeBuffer[data['id']];
          }
          console.log("Connect result: "+result);
        });
      });
    } else if (data['command'] == 'send') {
      if (!activeSockets.hasOwnProperty(data['id'])) {
        activeBuffer[data['id']] = b64toab(data.data);
      } else {
        chrome.socket.write(activeSockets[data['id']], b64toab(data.data), function(writeInfo){
          console.log(writeInfo);
        });
      }
    } else if (data['command'] == 'receive') {
      console.log(data.data);
      activeConnections[data['id']]._sendRawData(b64toab(data.data));
    }
  }

  var connect = document.createElement("button");
  connect.innerHTML = "Connect!";
  connect.addEventListener('click', function() {
    chatClient = new XmppDaemon(creds);
    chatClient.setRosterListener(rosterPrinter);
    chatClient.setStreamListener(streamListener);
  }, true);
  document.body.appendChild(connect);
  document.body.appendChild(status);
  document.body.appendChild(roster);
}

window.addEventListener('load', startup, true);
