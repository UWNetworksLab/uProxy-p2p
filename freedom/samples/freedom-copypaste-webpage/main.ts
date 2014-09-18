/// <reference path='../../../freedom/typings/freedom.d.ts' />
/// <reference path='../../../webrtc/peerconnection.d.ts' />

// Freedom apps don't have direct access to the page so this
// file mediates between the page's controls and the Freedom app.

// Locate all nodes of interest up front here to avoid code clutter later on.
var answerPanelNode = <HTMLElement>document.getElementById('answerPanel');
var answerPanel_consumeInboundMessageButtonNode = <HTMLElement>document.getElementById('answerPanel_consumeInboundMessageButton');
var answerPanel_generateIceCandidatesButton = <HTMLElement>document.getElementById('answerPanel_generateIceCandidatesButton');
var answerPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('answerPanel_inboundMessage');
var answerPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('answerPanel_outboundMessage');
var answerPanel_step2ContainerNode = <HTMLElement>document.getElementById('answerPanel_step2Container');

var offerPanelNode = <HTMLElement>document.getElementById('offerPanel');
var offerPanel_consumeInboundMessageButtonNode = <HTMLElement>document.getElementById('offerPanel_consumeInboundMessageButton');
var offerPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('offerPanel_inboundMessage');
var offerPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('offerPanel_outboundMessage');
var offerPanel_step2ContainerNode = <HTMLElement>document.getElementById('offerPanel_step2Container');

var startPanelNode = <HTMLElement>document.getElementById('startPanel');
var startPanel_getAccessLinkNode = <HTMLElement>document.getElementById('startPanel_getAccessLink');
var startPanel_giveAccessLinkNode = <HTMLElement>document.getElementById('startPanel_giveAccessLink');

var chatPanelNode = <HTMLElement>document.getElementById('chatPanel');
var chatPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('chatPanel_outboundMessage');
var chatPanel_sendMessageButtonNode = <HTMLElement>document.getElementById('chatPanel_sendMessageButton');
var chatPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('chatPanel_inboundMessage');

// DOM nodes that we will choose from either the 'give access' panel or the
// 'get access' panel once the user chooses whether to give/get.
var step2ContainerNode :HTMLElement;
var outboundMessageNode :HTMLInputElement;
var inboundMessageNode :HTMLInputElement;

// Stores the parsed messages for use later, if & when the user clicks the
// button for consuming the messages.
var parsedInboundMessages :WebRtc.SignallingMessage[];

startPanel_giveAccessLinkNode.onclick =
    function(event:MouseEvent) : any {
      step2ContainerNode = offerPanel_step2ContainerNode;
      outboundMessageNode = offerPanel_outboundMessageNode;
      inboundMessageNode = offerPanel_inboundMessageNode;

      startPanelNode.style.display = 'none';
      offerPanelNode.style.display = 'block';
    };

startPanel_getAccessLinkNode.onclick =
    function(event:MouseEvent) : any {
      step2ContainerNode = answerPanel_step2ContainerNode;
      outboundMessageNode = answerPanel_outboundMessageNode;
      inboundMessageNode = answerPanel_inboundMessageNode;

      startPanelNode.style.display = 'none';
      answerPanelNode.style.display = 'block';
    };

// Tells the Freedom app to create an instance of the socks-to-rtc
// Freedom module and initiate a connection.
answerPanel_generateIceCandidatesButton.onclick =
    function(event:MouseEvent) : any {
      this.disabled = true;

      freedom.emit('start', {});
    };

offerPanel_inboundMessageNode.onkeyup =
    function(event:Event) : any {
      parsedInboundMessages = parseInboundMessages(this, offerPanel_consumeInboundMessageButtonNode);
    };

answerPanel_inboundMessageNode.onkeyup =
    function(event:Event) : any {
      parsedInboundMessages = parseInboundMessages(this, answerPanel_consumeInboundMessageButtonNode);
    };

offerPanel_consumeInboundMessageButtonNode.onclick =
    function(event:MouseEvent) : any {
      consumeInboundMessage(offerPanel_inboundMessageNode);
    };

answerPanel_consumeInboundMessageButtonNode.onclick =
    function(event:MouseEvent) : any {
      consumeInboundMessage(answerPanel_inboundMessageNode);
      answerPanel_consumeInboundMessageButtonNode.disabled = true;
    };

chatPanel_sendMessageButtonNode.onclick =
    function(event:MouseEvent) : any {
      // TODO: cannot send empty messages
      freedom.emit('handleChatMessage',
          chatPanel_outboundMessageNode.value || '(empty message)');
    };

// Parses the contents of the form field 'inboundMessageField' as a sequence of
// signalling messages. Enables/disables the corresponding form button, as
// appropriate. Returns null if the field contents are malformed.
function parseInboundMessages(inboundMessageField:HTMLInputElement,
                              consumeMessageButton:HTMLElement)
    : WebRtc.SignallingMessage[] {
  var signals :string[] = inboundMessageField.value.trim().split('\n');

  // Each line should be a JSON representation of a WebRtc.SignallingMessage.
  // Parse the lines here.
  var parsedSignals :WebRtc.SignallingMessage[] = [];
  for (var i = 0; i < signals.length; i++) {
    var s :string = signals[i].trim();

    // TODO: Consider detecting the error if the text is well-formed JSON but
    // does not represent a WebRtc.SignallingMessage.
    var signal :WebRtc.SignallingMessage;
    try {
      signal = JSON.parse(s);
    } catch (e) {
      parsedSignals = null;
      break;
    }
    parsedSignals.push(signal);
  }

  // Enable/disable, as appropriate, the button for consuming the messages.
  var inputIsWellFormed :boolean = false;
  if (null !== parsedSignals && parsedSignals.length > 0) {
    inputIsWellFormed = true;
  } else {
    // TODO: Notify the user that the pasted text is malformed.
  }
  consumeMessageButton.disabled = !inputIsWellFormed;

  return parsedSignals;
}

// Forwards each line from the paste box to the Freedom app, which
// interprets each as a signalling channel message. The Freedom app
// knows whether this message should be sent to the socks-to-rtc
// or rtc-to-net module. Disables the form field.
function consumeInboundMessage(inboundMessageField:HTMLInputElement) : void {
  // Forward the signalling messages to the Freedom app.
  for (var i = 0; i < parsedInboundMessages.length; i++) {
    freedom.emit('handleSignalMessage', parsedInboundMessages[i]);
  }

  // Disable the form field, since it no longer makes sense to accept further
  // input in it.
  inboundMessageField.disabled = true;

  // TODO: Report success/failure to the user.
};


// Add signalling-channel messages to the box from which the user should
// copy/paste the outgoing message.
//
// TODO: Accumulate signalling messages until we have all of them, and only
// then update the textarea.
freedom.on('signalForPeer', (signal:WebRtc.SignallingMessage) => {
  step2ContainerNode.style.display = 'block';

  outboundMessageNode.value =
      outboundMessageNode.value.trim() + '\n' + JSON.stringify(signal);
});

// Display this inbound chat message to the user.
freedom.on('messageForPeer', (message:string) => {
  chatPanel_inboundMessageNode.value = message;
});

// Called when a peer-to-peer connection has been established.
freedom.on('ready', () => {
  offerPanelNode.style.display = 'none';
  answerPanelNode.style.display = 'none';
  chatPanelNode.style.display = 'block';
});
