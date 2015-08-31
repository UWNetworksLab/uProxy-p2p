/// <reference path='../../../../third_party/freedom-typings/freedom-core-env.d.ts' />

// This is an abstract type intended to abstract over the signalling messages.
interface SignallingMessage {
  // We use this patten to add a specially named member to avoid type-clashes.
  abstract_type_SignallingMessage: Object;
}

// Freedom apps don't have direct access to the page so this
// file mediates between the page's controls and the Freedom app.

// Locate all nodes of interest up front here to avoid code clutter later on.
var answerPanelNode = <HTMLElement>document.getElementById('answerPanel');
var answerPanel_consumeInboundMessageButtonNode = <HTMLButtonElement>document.getElementById('answerPanel_consumeInboundMessageButton');
var answerPanel_generateIceCandidatesButton = <HTMLButtonElement>document.getElementById('answerPanel_generateIceCandidatesButton');
var answerPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('answerPanel_inboundMessage');
var answerPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('answerPanel_outboundMessage');
var answerPanel_step2ContainerNode = <HTMLElement>document.getElementById('answerPanel_step2Container');

var offerPanelNode = <HTMLElement>document.getElementById('offerPanel');
var offerPanel_consumeInboundMessageButtonNode = <HTMLButtonElement>document.getElementById('offerPanel_consumeInboundMessageButton');
var offerPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('offerPanel_inboundMessage');
var offerPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('offerPanel_outboundMessage');
var offerPanel_step2ContainerNode = <HTMLElement>document.getElementById('offerPanel_step2Container');

var startPanelNode = <HTMLElement>document.getElementById('startPanel');
var startPanel_offerLinkNode = <HTMLElement>document.getElementById('startPanel_offerLink');
var startPanel_answerLinkNode = <HTMLElement>document.getElementById('startPanel_answerLink');

var chatPanelNode = <HTMLElement>document.getElementById('chatPanel');
var chatPanel_outboundMessageNode = <HTMLInputElement>document.getElementById('chatPanel_outboundMessage');
var chatPanel_sendMessageButtonNode = <HTMLButtonElement>document.getElementById('chatPanel_sendMessageButton');
var chatPanel_inboundMessageNode = <HTMLInputElement>document.getElementById('chatPanel_inboundMessage');

freedom('freedom-module.json', {
    'logger': 'uproxy-lib/loggingprovider/freedom-module.json',
    'debug': 'debug'
  }).then(
    (copypasteModuleFactory:() => freedom.OnAndEmit<any,any>) => {
  // TODO: Make this have a freedom API.
  var copypaste :freedom.OnAndEmit<any,any> = copypasteModuleFactory();

  // DOM nodes that we will choose from either the offer panel or the
  // answer panel once the user chooses whether to offer/answer.
  var step2ContainerNode :HTMLElement;
  var outboundMessageNode :HTMLInputElement;
  var inboundMessageNode :HTMLInputElement;

  // Stores the parsed messages for use later, if & when the user clicks the
  // button for consuming the messages.
  var parsedInboundMessages :SignallingMessage[];

  startPanel_answerLinkNode.onclick =
      function(event:MouseEvent) : void {
        step2ContainerNode = offerPanel_step2ContainerNode;
        outboundMessageNode = offerPanel_outboundMessageNode;
        inboundMessageNode = offerPanel_inboundMessageNode;

        startPanelNode.style.display = 'none';
        offerPanelNode.style.display = 'block';
      };

  startPanel_offerLinkNode.onclick =
      function(event:MouseEvent) : void {
        step2ContainerNode = answerPanel_step2ContainerNode;
        outboundMessageNode = answerPanel_outboundMessageNode;
        inboundMessageNode = answerPanel_inboundMessageNode;

        startPanelNode.style.display = 'none';
        answerPanelNode.style.display = 'block';
      };

  // Tells the Freedom app to create an instance of the socks-to-rtc
  // Freedom module and initiate a connection.
  answerPanel_generateIceCandidatesButton.onclick =
      function(event:MouseEvent) : void {
        this.disabled = true;

        copypaste.emit('start', {});
      };

  offerPanel_inboundMessageNode.onkeyup =
      function(event:Event) : void {
        parsedInboundMessages = parseInboundMessages(this, offerPanel_consumeInboundMessageButtonNode);
      };

  answerPanel_inboundMessageNode.onkeyup =
      function(event:Event) : void {
        parsedInboundMessages = parseInboundMessages(this, answerPanel_consumeInboundMessageButtonNode);
      };

  offerPanel_consumeInboundMessageButtonNode.onclick =
      function(event:MouseEvent) : void {
        consumeInboundMessage(offerPanel_inboundMessageNode);
      };

  answerPanel_consumeInboundMessageButtonNode.onclick =
      function(event:MouseEvent) : void {
        consumeInboundMessage(answerPanel_inboundMessageNode);
        answerPanel_consumeInboundMessageButtonNode.disabled = true;
      };

  chatPanel_sendMessageButtonNode.onclick =
      function(event:MouseEvent) : void {
        // TODO: cannot send empty messages
        copypaste.emit('messageFromPeer',
            chatPanel_outboundMessageNode.value || '(empty message)');
      };

  // Parses the contents of the form field 'inboundMessageField' as a sequence of
  // signalling messages. Enables/disables the corresponding form button, as
  // appropriate. Returns null if the field contents are malformed.
  function parseInboundMessages(inboundMessageField:HTMLInputElement,
                                consumeMessageButton:HTMLButtonElement)
      : SignallingMessage[] {
    var signals :string[] = inboundMessageField.value.trim().split('\n');

    // Each line should be a JSON representation of a SignallingMessage.
    // Parse the lines here.
    var parsedSignals :SignallingMessage[] = [];
    for (var i = 0; i < signals.length; i++) {
      var s :string = signals[i].trim();

      // TODO: Consider detecting the error if the text is well-formed JSON but
      // does not represent a SignallingMessage.
      var signal :SignallingMessage;
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
      copypaste.emit('signalFromPeer', parsedInboundMessages[i]);
    }

    // Disable the form field, since it no longer makes sense to accept further
    // input in it.
    inboundMessageField.readOnly = true;

    // TODO: Report success/failure to the user.
  };

  // Add signalling-channel messages to the box from which the user should
  // copy/paste the outgoing message.
  //
  // TODO: Accumulate signalling messages until we have all of them, and only
  // then update the textarea.
  copypaste.on('signalForPeer', (signal:SignallingMessage) => {
    step2ContainerNode.style.display = 'block';

    outboundMessageNode.value =
        outboundMessageNode.value.trim() + '\n' + JSON.stringify(signal);
  });

  // Display this inbound chat message to the user.
  copypaste.on('messageFromPeer', (message:string) => {
    chatPanel_inboundMessageNode.value = message;
  });

  // Called when a peer-to-peer connection has been established.
  copypaste.on('ready', () => {
    console.log('ready');
    offerPanelNode.style.display = 'none';
    answerPanelNode.style.display = 'none';
    chatPanelNode.style.display = 'block';
  });
}, (e:Error) => {
  console.error('could not load freedom: ' + e.message);
});
