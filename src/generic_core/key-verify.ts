import crypto = require('crypto');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingTypes =
  require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
var log :logging.Log = new logging.Log('KeyVerify');

// KeyVerify's callbacks API from ZRTP protocol.
export interface Delegate {

  // Send this message to the peer KeyVerify
  sendMessage(msg:any) :Promise<void>;

  // Show this Short Authentication String to the user, and ask them
  // if it's the same as what their peer sees.  resolve(true) if it
  // is, resole(false) if not.
  showSAS(sas:string) :Promise<boolean>;
};

export enum Type { Hello1, Hello2, Commit, DHPart1, DHPart2, Confirm1, Confirm2,
                   Conf2Ack };

export namespace Messages {
  export class HelloMessage {
    constructor(public type: string, public version: string, public h3: string,
                public hk: string, public clientVersion: string,
                public mac: string){}
  };

  export class CommitMessage {
    constructor(public type: string, public h2: string, public hk: string,
                public clientVersion: string, public hvi: string,
                public mac: string){}
  };

  export class DHPartMessage {
    constructor(public type: string, public h1: string, public pkey: string,
                public mac: string) {}
  };

  export class ConfirmMessage {
    constructor(public type: string, public h0: string, public mac: string) {}
  };

  export class ConfAckMessage {
    constructor(public type:string) {}
  };

  export class Tagged {
    constructor(
      public type: Type,
      public value: HelloMessage|CommitMessage|DHPartMessage|
        ConfirmMessage|ConfAckMessage) {}
  };
};

/*
  Buffer utility functions
 */

function str2buf(s:string) :Buffer {
  return new Buffer(s, 'utf8');
}

function unb64(s:string) :Buffer {
  return new Buffer(s, 'base64');
}

function hexify(buf:Buffer) {
  var linebuf = "";
  for (var i = 0; i < buf.length; i++) {
    var n :number = buf.readInt8(i);
    if (n < 0) {
      n = (-n ^ 0xff) + 1;
    }
    var c = n.toString(16);
    if (c.length < 2) {
      c = "0" + c;
    }
    linebuf = linebuf + ' ' + c;
  }
  return linebuf;
}

function logBuffer(name:string, buf:Buffer) {
  var kBufWidth = 75;
  var linebuf = name + ":";
  var remain_size = kBufWidth - linebuf.length;
  for (var i = 0; i < buf.length; i++) {
    if (remain_size < 3) {
      log.debug(linebuf);
      linebuf = "";
      remain_size = kBufWidth;
    }
    var n :number = buf.readInt8(i);
    if (n < 0) {
      n = (-n ^ 0xff) + 1;
    }
    var c = n.toString(16);
    if (c.length < 2) {
      c = "0" + c;
    }
    linebuf = linebuf + ' ' + c;
    remain_size -= 3;
  }
  if (linebuf.length) {
    log.debug(linebuf);
  }
}

export class HashPair {
  public b64 :string;
  constructor(public bin:Buffer) {
    this.b64 = bin.toString('base64');
  }
};

export class Hashes {
  public h0 :HashPair;
  public h1 :HashPair;
  public h2 :HashPair;
  public h3 :HashPair;
};


function makeHash(s:string) :HashPair {
  let bin = crypto.createHash('sha256').update(s).digest();
  return new HashPair(bin);
}

function hashBuffers(...bufs:Buffer[]) :HashPair {
  let buffer = Buffer.concat(bufs);
  let bin = crypto.createHash('sha256').update(buffer).digest();
  return new HashPair(bin);
}

function hashString(s:string) :string {
  return crypto.createHash('sha256').update(s).digest('base64');
}

// Values from messages are base64 encoded, and many of the
// cryptographic operations used in ZRTP require that they be
// concatenated before we hash them.
function unbase64Concat(...args:string[]) :Buffer {
  let buffers = args.map( (val:string) => {
    return new Buffer(val, 'base64');
  });
  return Buffer.concat(buffers);
}

export class KeyVerify {
  // Only written by set(), after verifying the message.
  private messages_: {[type:string]:Messages.Tagged}; // indexed by Type.
  // Only written and read by sendNextMessage(), between the time we
  // call generate_ and get its promise-return.
  private queued_generations_: {[type:string]:boolean}; // indexed by Type.

  // Zero or 1.  role_ 0 sends Hello1.  role_ 1 sends Hello2.  Generally, it
  // shouldn't determine who's sending 'Commit', but right now, we only support
  // role_ == 0 sending Commit.
  private role_:number;
  private ourKey_:freedom.PgpProvider.PublicKey;
  private peerPubKey_:string;
  private ourHashes_:Hashes;
  private result_:Promise<void>;
  private delegate_:Delegate;
  private resolvePromise_ : () => void;
  private rejectPromise_ : () => void;
  // Explicitly mark when we've already fired a resolution promise, to
  // prevent an attacker from passing us extra stuff that might make
  // us change our minds.
  private completed_:boolean;

  private pgp_ :freedom.PgpProvider.PgpProvider;
  // Data that requires expensive calculations to make.  These are a innately
  // hackey, and I don't like them.
  private s0_ :Buffer = null;
  private totalHash_ :Buffer = null;

  private static kPgpPassword :string = '';
  private static kPgpUser :string = '<uproxy>';
  private static kClientVersion :string = '0.1';
  private static kProtocolVersion :string = '1.0';
  private static seqno :number = 1;
  private static emptyPreReq :Type[] = [];
  private static keyMap_ :{[type:string]:string}= {
    'Hello1':'clientVersion,h3,hk,mac,type,version',
    'Hello2':'clientVersion,h3,hk,mac,type,version',
    'Commit':'clientVersion,h2,hk,hvi,mac,type',
    'DHPart1':'h1,mac,pkey,type',
    'DHPart2':'h1,mac,pkey,type',
    'Confirm1':'h0,mac,type',
    'Confirm2':'h0,mac,type',
    'Conf2Ack':'type'
  };
  private static prereqMap_ :{[msg:string]:[Type]} = {
    'Hello1': <[Type]>[],
    'Hello2': <[Type]>[],
    'Commit':[Type.Hello1, Type.Hello2],
    'DHPart1':[Type.Commit],
    'DHPart2':[Type.DHPart1],
    'Confirm1':[Type.DHPart2],
    'Confirm2':[Type.Confirm1],
    'Conf2Ack':[Type.Confirm2]
  };

  // Which role receives which kinds of messages.  Clearly this gets
  // complicated if we ever want to let either side initiate
  // verification.
  private static roleMessageMap_ :{[msg:string]:number} = {
    'Hello1': 1,
    'Hello2': 0,
    'Commit': 1,
    'DHPart1': 0,
    'DHPart2': 1,
    'Confirm1': 0,
    'Confirm2': 1,
    'Conf2Ack': 0
  };

  private generatorMap_ : {[msg:string]:((type:Type) =>Promise<Messages.Tagged>)};

  // Messages are existing messages received or sent in the
  // conversation.  Useful both for testing and for when this Verifier
  // is being created in response to a received message.
  constructor(peerPubKey: string,
              delegate: Delegate,
              messages?: {[type:string]:Messages.Tagged},
              role?: number,
              ourHashes?: Hashes) {
    this.peerPubKey_ = peerPubKey;
    this.delegate_ = delegate;
    this.completed_ = false;
    this.totalHash_ = null;
    if (messages === undefined) {
      // Beginning of conversation.
      this.messages_ = {};
      this.role_ = 0;
      this.ourHashes_ = this.generateHashes_();
    } else {
      // Peer started conversation, or this is a resumption (say, from a test
      // case).
      this.messages_ = messages;
      this.role_ = role;
      // See if we're a resumption.
      if (ourHashes) {
        this.ourHashes_ = ourHashes;
      } else {
        this.ourHashes_ = this.generateHashes_();
      }
    }
    this.queued_generations_ = {};
    // These are all closed on 'this' now, so we have to init this here.
    this.generatorMap_ = {
      'Hello1': this.makeHello_,
      'Hello2': this.makeHello_,
      'Commit': this.makeCommit_,
      'DHPart1': this.makeDHPart_,
      'DHPart2': this.makeDHPart_,
      'Confirm1': this.makeConfirm_,
      'Confirm2': this.makeConfirm_,
      'Conf2Ack': this.makeConf2Ack_
    };
  }

  // Create a Messages.Tagged from an arbitrary message.  Designed for
  // receiving Hello1 messages without the client having to know about
  // them.
  public static readFirstMessage(msg:any) : {[type:string]:Messages.Tagged} {
    if (msg['type'] && KeyVerify.structuralVerify_(msg) && msg.type == 'Hello1') {
      if (msg.clientVersion !== KeyVerify.kClientVersion ||
          msg.version !== KeyVerify.kProtocolVersion) {
        log.error("Invalid Hello message (versions): ", msg);
        return null;
      }
      var result :{[type:string]:Messages.Tagged} = {};
      result[Type.Hello1] = new Messages.Tagged(
        Type.Hello1, new Messages.HelloMessage(
          msg.type, msg.version, msg.h3, msg.hk, msg.clientVersion, msg.mac));
      return result;
    }
    return null;
  }

  public readMessage(msg:any) {
    if (msg['type'] && KeyVerify.structuralVerify_(msg) &&
        this.protoVerify_(msg) && this.appropriateForRole_(msg.type)) {
      let type = msg.type;
      console.log("GOT MESSAGE TYPE " + type);
      // When verifying these messages:
      //  1. Compare the calculation of these values aginst the ones
      //     in the makeMSG_ methods.
      //  2. Remember to keep track of whether the calculation is
      //     using the base64 or binary values
      if (type == 'Hello1' || type == 'Hello2') {
        // Validate this Hello message.  Later versions may set some
        // local state to maintain compatability with prior versions
        // of uProxy.
        if (msg.clientVersion !== KeyVerify.kClientVersion ||
            msg.version !== KeyVerify.kProtocolVersion) {
          console.log("Invalid Hello message (versions): ", msg);
          this.resolve_(false);
          return;
        }
        var rawType :number = parseInt(Type[msg.type]);
        // role 0 should receive hello2, and role 1 should receive hello1.
        if ((this.role_ == 0 && rawType !== Type.Hello2) ||
            (this.role_ == 1 && rawType !== Type.Hello1)) {
          console.log("Got the wrong Hello message (" + type + " [" + rawType +
                      "]) for this role (" + this.role_ + ")");
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(
          rawType,
          new Messages.HelloMessage(msg.type, msg.version, msg.h3, msg.hk,
                                    msg.clientVersion, msg.mac)));

      } else if (type == 'Commit') {
        if (msg.clientVersion !== KeyVerify.kClientVersion) {
          console.log("Invalid Commit message (clientVersion)", msg);
          this.resolve_(false);
          return;
        }
        // Validate the Hello message's mac.
        let hello1 = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (msg.clientVersion !== hello1.clientVersion) {
          log.error("Client changed versions mid-conversation.", msg,
                    hello1);
          this.resolve_(false);
          return;
        }
        let desiredMac = this.mac_(msg.h2, unb64(hello1.h3), str2buf(hello1.hk),
                                      str2buf(hello1.clientVersion));
        if (hello1.mac !== desiredMac) {
          console.log("MAC mismatch (found " + hello1.mac + ", wanted " +
                      desiredMac + ") for Hello1 found. h2: ", msg.h2,
                      " and Hello1: ", hello1);
          console.log("msg.h2", msg.h2);
          logBuffer("unb64(hello1.h3)", unb64(hello1.h3));
          logBuffer("unb64(hello1.hk)", unb64(hello1.hk));
          logBuffer("str2buf(hello1.clientVersion)", str2buf(hello1.clientVersion));
          this.resolve_(false);
          return;
        }
        // Validate that h3 is the hash of h2. hello1.h3 is peer's
        // ourHashes_.h3.b64.  msg.h2 is peer's ourHashes_.h2.b64.
        // So, unb64 it, then hash it, then make a string of that.
        let desiredH3 = hashBuffers(unb64(msg.h2)).b64
        if (hello1.h3 !== desiredH3) {
          console.log("Hash chain failure for h3: ", hello1.h3,
                      " and h2: ", msg.h2, " (hashed to ", desiredH3, ")");
          this.resolve_(false);
          return;
        }
        // Check that the peer can be the initiato.
        if (this.role_ !== 1) {
          console.log("Currently, we only support that role 0 is initiator.");
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(
          Type.Commit, new Messages.CommitMessage(
            msg.type, msg.h2, msg.hk, msg.clientVersion, msg.hvi, msg.mac)));

      } else if (type == 'DHPart1') {
        // We don't have an h2 value to check the hello2 message.
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (hello2.hk !== hashString(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart1 (",msg.pkey,
                      ") vs Hello2 (", hello2.hk, ")");
          this.resolve_(false);
          return;
        }

        this.set_(new Messages.Tagged(
          Type.DHPart1, new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey,
                                                   msg.mac)));

        // There's an explicit choice here to treat the primary failure
        // mode - a failed SAS verification, the same as an I/O error.
        // Attackers may just kill the connection to look like an I/O
        // error, so we don't want the users to be mislead by the user
        // interface messaging here.  Instead, let them try again and
        // be more careful about the numbers.  If the numbers don't
        // match up, they know that they're under attack.
        this.calculateSAS_().then((sas:number) => {
          this.delegate_.showSAS(sas.toString()).then((result:boolean) => {
            if (result) {
              this.sendNextMessage();
            } else {
              console.log("Failed SAS verification.");
              this.resolve_(false);
            }
          });
        });
      } else if (type == 'DHPart2') {
        // Verify that this is the sam ehk.
        let commit = <Messages.CommitMessage>this.messages_[Type.Commit].value;
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (commit.hk !== hashString(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart2 (",msg.pkey,
                      ") vs Commit (", commit.hk, ")");
          this.resolve_(false);
          return;
        }
        // Verify the mac of the Commit.
        if (commit.mac !==
            this.mac_(msg.h1,
                         unb64(commit.h2), unb64(commit.hk),
                         str2buf(commit.clientVersion), unb64(commit.hvi))) {
          console.log("MAC mismatch for Commit found. h1: ", msg.h1,
                      " and Commit: ", commit);
          this.resolve_(false);
          return;
        }
        // Check that hvi is correct.
        let hvi = hashBuffers(
          unb64(msg.h1), str2buf(msg.pkey), unb64(msg.mac),
          unb64(hello2.h3), unb64(hello2.hk), unb64(hello2.mac)).b64;
        if (hvi !== commit.hvi) {
          console.log("hvi Mismatch in commit. Wanted: ", hvi, " got: ",
                      msg);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(
          Type.DHPart2, new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey,
                                                   msg.mac)));
        this.calculateSAS_().then((sas:number) => {
          this.delegate_.showSAS(sas.toString()).then((result:boolean) => {
            if (result) {
              this.sendNextMessage();
            } else {
              console.log("Failed SAS verification.");
              this.resolve_(false);
            }
          });
        });
      } else if (type == 'Confirm1') {
        // Validate DHpart1
        let dhpart1 = <Messages.DHPartMessage>this.messages_[Type.DHPart1].value;
        if (dhpart1.mac !==
            this.mac_(msg.h0, unb64(dhpart1.h1), str2buf(dhpart1.pkey))) {
          console.log("CHECK: MAC mismatch for DHPart1 found. h0: ", msg.h0,
                      " and DHPart1: ", dhpart1);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(
          Type.Confirm1, new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));

      } else if (type == 'Confirm2') {
        // Validate DHpart2
        let dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
        if (dhpart2.mac !==
            this.mac_(msg.h0, unb64(dhpart2.h1), str2buf(dhpart2.pkey))) {
          console.log("CHECK: MAC mismatch for DHPart2 found. h0: ", msg.h0,
                      " and DHPart2: ", dhpart2);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(
          Type.Confirm2, new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));

        // Don't resolve here, wait until we've sent 
      } else if (type == 'Conf2Ack') {
        this.set_(new Messages.Tagged(
          Type.Conf2Ack, new Messages.ConfAckMessage(msg.type)));
        console.log ("EVERYTHING IS DONE!!");
        this.resolve_(true);
      }
      if (type !== 'Conf2Ack') {
        this.sendNextMessage();
      }
    } else {
      // reject the message for member key mismatch.
      console.log("Invalid message received: ", msg);
    }
  }

  private resolve_(res:boolean) {
    console.log("resolve("+res+")");
    this.completed_ = true;
    if (res) {
      this.resolvePromise_();
    } else {
      this.rejectPromise_();
    }
  }

  public start() :Promise<void>{
    console.log("start() starting.");
    if (this.completed_) {
      throw (new Error("KeyVerify.start: Already completed."));
    }
    return this.loadKeys_().then(() => {
      console.log("start() callback invoked.");
      this.result_ = new Promise<void>((resolve:any, reject:any) => {
        console.log("start(): initializing result_.");
        this.resolvePromise_ = resolve;
        this.rejectPromise_ = reject;
        this.sendNextMessage();
      });
      return this.result_;
    });
  }

  private loadKeys_() :Promise<void> {
    this.pgp_ = <freedom.PgpProvider.PgpProvider>globals.pgp;
    console.log("loadKeys(): starting.");
    // our public key is globals.publicKey, but we need the fingerprint, so
    // import the one in globals here, and get the higher-level object here.
    return this.pgp_.exportKey().then((key:freedom.PgpProvider.PublicKey) => {
      console.log("loadKeys: got key ", key);
      this.ourKey_ = key;
      return Promise.resolve<void>();
    });
  }

  // Logic for determining the next
  public sendNextMessage() {
    if (this.completed_) {
      throw (new Error("KeyVerify.sendNextMessage: Already completed."));
    }
    log.debug("sendNextMessage(): starting.");
    // Look at where we are in the conversation.
    // - figure out the latest message that isn't in the set.
    // - see if we have its prereq.
    // - send it.
    let msgType:Type;
    if (this.role_ == 0) {
      if (this.messages_[Type.Conf2Ack]) {
        console.log("sendNextMessage: done!");
        this.resolve_(true);
        return; // all done.
      } else if (this.messages_[Type.Confirm1]) {
        msgType = Type.Confirm2;
      } else if (this.messages_[Type.DHPart1]) {
        msgType = Type.DHPart2;
      } else if (this.messages_[Type.Hello2]) {
        msgType = Type.Commit;
      } else {
        msgType = Type.Hello1;
      }
    } else {
      if (this.messages_[Type.Conf2Ack]) {
        console.log("sendNextMessage: done!");
        this.resolve_(true);
        return; // all done.
      } else if (this.messages_[Type.Confirm2]) {
        msgType = Type.Conf2Ack;
      } else if (this.messages_[Type.DHPart2]) {
        msgType = Type.Confirm1;
      } else if (this.messages_[Type.Commit]) {
        msgType = Type.DHPart1;
      } else {
        msgType = Type.Hello2;
      }
    }

    if (!this.messages_[msgType] &&
        !this.queued_generations_[Type[msgType]]) {
      this.queued_generations_[Type[msgType]] = true;
      this.generate_(msgType).then( (msg:Messages.Tagged) => {
        this.queued_generations_[Type[msgType]] = false;
        this.set_(msg);
        this.delegate_.sendMessage(msg.value).then(() => {
          if (msgType == Type.Conf2Ack) {
            console.log("EVERYTHING IS DONE ON THIS SIDE TOO");
            this.resolve_(true);
          }
        }).catch((e) => {
          console.log("Failed to send message in ZRTP message.  Resolving as " +
                      "failure.", e);
          this.resolve_(false);
        });
      });
    }
  }

  // Message schema verification.
  private static structuralVerify_ (msg:any) :boolean {
    // Verify that none of the values are blank.
    let allKeys = Object.keys(msg);
    for (let k in allKeys) {
      if (msg[allKeys[k]].length == '') {
        console.log("Verify msg ", msg, " got empty value for key ", k);
        return false;
      }
    }
    // Verify that we only have the keys we're expecting.
    let type :string = msg.type.toString();
    if (allKeys.sort().join() !== KeyVerify.keyMap_[type]) {
      console.log("Verify msg ", msg, " bad key set.  Wanted ", 
                  KeyVerify.keyMap_[type], " got ", allKeys.sort().join());
      return false;
    }
    // Verify that we have all the prerequisite messages for this one.
    return true;
  }

  // Message protocol-order verification.
  private protoVerify_ (msg:any) :boolean {
    let type :Type = parseInt(Type[msg.type.toString()]);
    for (let m in KeyVerify.prereqMap_[type]) {
      let t = KeyVerify.prereqMap_[type][m];
      if (!this.messages_[t]) {
        console.log("Verify msg ", msg, " missing prerequisite ", t);
        return false;
      }
    }
    return true;
  }

  // Whether we should even receive the given message type.  If not,
  // perhaps we're under attack?
  private appropriateForRole_(type:string) :boolean {
    if (KeyVerify.roleMessageMap_[type] !== undefined) {
      return KeyVerify.roleMessageMap_[type] == this.role_;
    } else {
      return false;
    }
  }

  // Register a message as an accepted part of the conversation.  The
  // message must have been a validated received message, or a message
  // we've sent.
  private set_(message: Messages.Tagged) :void {
    // parseInt returns NaN for non-ints, and NaNs always compare
    // false in </>/= comparisons.
    if (!(parseInt(message.type.toString()) < 0) &&
        !(parseInt(message.type.toString()) >= 0)) {
      console.log("set_: bad type: ", message.type);
    }
    if (this.messages_[message.type]) {
      console.log("set_: already have a message of ", message.type, " (" +
                  Type[message.type] + ")");
      this.resolve_(false);
    } else {
      console.log("set_: setting message of ", message.type, " (" +
                  Type[message.type] + ")");
      this.messages_[message.type] = message;
    }
  }

  //
  // Message Generation
  //
  // Primary entry point is generate_, which just looks in an internal
  // table set up in the constructor.  The table has to be set up
  // there, as we're using this-bound closures in the table.
  private generate_(type: Type) :Promise<Messages.Tagged> {
    if (this.completed_) {
      throw (new Error("KeyVerify.start: Already completed."));
    }

    if (this.generatorMap_[Type[type]] !== undefined) {
      return this.generatorMap_[Type[type]](type);
    } else {
      console.log("generate(" + type + "<" + Type[type] +
                  ">): can't generate this type.");
      throw (new Error("generate(" + Type[type] + ") not yet implemented."));
    }
  }

  private makeHello_ =  (type: Type) :Promise<Messages.Tagged> => {
    console.log("makeHello(" + type + " <" + Type[type] + ">)");
    let h3 = this.ourHashes_.h3,
        hk = this.ourKey_.key;
    logBuffer("makeHello: h3:", h3.bin);
    logBuffer("makeHello: hk "+ hk + " and str2buf'd: ", str2buf(hk));
    logBuffer("makeHello: clientVersion", str2buf(KeyVerify.kClientVersion));
    let mac = this.mac_(this.ourHashes_.h2.b64,
                           h3.bin,str2buf(hashString(hk)),
                           str2buf(KeyVerify.kClientVersion));
    console.log("makeHello: mac: ", mac);
    let message = new Messages.Tagged(type, new Messages.HelloMessage(
      Type[type], KeyVerify.kProtocolVersion, h3.b64, hashString(hk),
      KeyVerify.kClientVersion, mac));

    return Promise.resolve<Messages.Tagged>(message);
  }

  private makeDHPart_ = (type:Type) :Promise<Messages.Tagged> => {
    if (type !== (this.role_ == 0 ? Type.DHPart2 : Type.DHPart1)) {
      throw (new Error("makeDHPart: Bad type " + Type[type] + " for role " +
                       this.role_));
    }
    let h1 = this.ourHashes_.h1;
    let pkey = this.ourKey_.key;
    let mac = this.mac_(this.ourHashes_.h0.b64, h1.bin, str2buf(pkey));
    let message = new Messages.Tagged(type, new Messages.DHPartMessage(
      Type[type], h1.b64, pkey, mac));
    return Promise.resolve<Messages.Tagged>(message);
  }

  private makeCommitWorker_(type:Type,
                            dh2:Messages.Tagged) :Promise<Messages.Tagged> {
    // Don't depend on dhpart2 being in our saved messages yet, as we
    // may not have sent it out (just generated it).  Pass it in as an
    // argument.
    let dhpart2 = <Messages.DHPartMessage>dh2.value;
    let hello = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
    let hvi = hashBuffers(
      unb64(dhpart2.h1), str2buf(dhpart2.pkey), unb64(dhpart2.mac),
      unb64(hello.h3), unb64(hello.hk), unb64(hello.mac)
    );
    let h2 = this.ourHashes_.h2;
    let hk = makeHash(this.ourKey_.key);
    let version = KeyVerify.kClientVersion;
    return Promise.resolve<Messages.Tagged>(
      new Messages.Tagged(Type.Commit, new Messages.CommitMessage(
        Type[Type.Commit], h2.b64, hk.b64, KeyVerify.kClientVersion, hvi.b64,
        this.mac_(this.ourHashes_.h1.b64, h2.bin, hk.bin, str2buf(version),
                     hvi.bin))));
  }

  private makeCommit_ = (type:Type) :Promise<Messages.Tagged> => {
    if (this.role_ !== 0 || type != Type.Commit) {
      throw (new Error("makeCommit: only supports making Commit messages " +
                       "with role 0 being initiator."));
    }
    if (!this.messages_[Type.DHPart2]) {
      return this.makeDHPart_(Type.DHPart2).then( (msg:Messages.Tagged) => {
        // this.set_(msg);  // don't set() unless we've sent or recevied it.
        // TODO: consider caching this message for later transmission.
        return this.makeCommitWorker_(type, msg);
      });
    } else {
      return this.makeCommitWorker_(type, this.messages_[Type.DHPart2]);
    }

  }

  private makeConfirm_ = (type:Type) :Promise<Messages.Tagged> => {
    if (type !== Type.Confirm1 && type !== Type.Confirm2) {
      throw (new Error("makeConfirm cannot make " + Type[type] + " messages"));
    }
    return this.calculateS0_().then( (s0 :Buffer) => {
      let h0 = this.ourHashes_.h0;
      return Promise.resolve<Messages.Tagged>(
        new Messages.Tagged(type, new Messages.ConfirmMessage(
          Type[type], h0.b64, this.mac_(s0.toString('base64'), h0.bin))));
    });
  }

  private makeConf2Ack_ = (type:Type) :Promise<Messages.Tagged> => {
    if (type !== Type.Conf2Ack) {
      throw (new Error("makeConf2Ack can only make Conf2Ack."));
    }
    return Promise.resolve<Messages.Tagged>(
      new Messages.Tagged(type, new Messages.ConfAckMessage('Conf2Ack')));
  };

  //
  // Crypto Stuff
  //
  // This is all based off of ZRTP (RFC 6189), with keys that don't
  // expire, and no caching.
  private generateHashes_() :Hashes {
    var result : Hashes = new Hashes();
    let h0Hash = crypto.createHash('sha256'),
        h1Hash = crypto.createHash('sha256'),
        h2Hash = crypto.createHash('sha256'),
        h3Hash = crypto.createHash('sha256');
    h0Hash.update((new Date()).toISOString() + '--' + KeyVerify.seqno);
    KeyVerify.seqno++;
    let h0 = h0Hash.digest();
    result.h0 = new HashPair(h0);
    h1Hash.update(h0);
    let h1 = h1Hash.digest();
    result.h1 = new HashPair(h1);
    h2Hash.update(h1);
    let h2 = h2Hash.digest();
    result.h2 = new HashPair(h2);
    h3Hash.update(h2);
    let h3 = h3Hash.digest();
    result.h3 = new HashPair(h3);
    let hashes :[string] = [h3.toString('base64'), h2.toString('base64'),
                            h1.toString('base64'), h0.toString('base64')];
    console.log("Generated hashes: ", hashes);
    return result;
  }

  private calculateS0_() :Promise<Buffer> {
    if (this.s0_ !== null) {
      logBuffer("s0: calculateS0_: State=" + this.state_() +
                ", returning cached", this.s0_);
      return Promise.resolve<Buffer>(this.s0_);
    }
    return this.pgp_.ecdhBob('P_256', this.peerPubKey_).then(
      (result:ArrayBuffer) => {
        console.log("CALCULATING s0");
        let be64Zero = new Buffer(8),
            beZero = new Buffer(4),
            beOne = new Buffer(4);
        be64Zero.fill(0);
        beZero.fill(0);
        beOne.writeInt32BE(1,0);
        // RFC6189-4.4.1.4
        let total_hash = this.calculateTotalHash_();
        let resultBuffer = new Buffer(new Uint8Array(result));
        let s0_input = Buffer.concat([
          beOne, resultBuffer, new Buffer("ZRTP-HMAC-KDF"), be64Zero,
          be64Zero, total_hash, beZero, beZero, beZero]);
        logBuffer("s0: result", resultBuffer);
        logBuffer("s0: total_hash", total_hash);
        logBuffer("s0: beOne", beOne);
        logBuffer("s0: be64Zero", be64Zero);
        logBuffer("s0: beZero", beZero);

        let s0 = crypto.createHash('sha256').update(s0_input).digest();
        logBuffer("s0", s0);
        this.s0_ = s0;
        return Promise.resolve<Buffer>(s0);
      });
  }

  private calculateSAS_() :Promise<number> {
    return this.calculateS0_().then(
      (s0:Buffer) => {
        let be64Zero = new Buffer(8),
            be32Zero = new Buffer(4),
            beOne = new Buffer(4);
        be64Zero.fill(0);
        be32Zero.fill(0);
        beOne.writeInt32BE(1,0);
        let total_hash = this.calculateTotalHash_();
        let kdf_context = Buffer.concat([ be64Zero, be64Zero, total_hash ]);
        logBuffer("kdf_context", kdf_context);
        // RFC6189-4.5.2
        let sashash = this.kdf_(s0, "SAS", kdf_context, 256);
        logBuffer("sashash", sashash);
        let sasvalue = sashash.slice(0, 4);
        logBuffer("sasvalue", sasvalue);
        let sasHumanInt :number = sasvalue.slice(0,2).readUInt16BE(0);
        return Promise.resolve<number>(sasHumanInt);
    });
  }

  private calculateTotalHash_() :Buffer {
//    if (this.totalHash_ !== null) {
//      return this.totalHash_;
//    }
    let hello_r :Messages.HelloMessage;
    // We only support role 0 committing, making role 1 (who sent
    // hello2) the responder.
//    if (this.role_ == 0) {
//      hello_r = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
//    } else {
      hello_r = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
//    }

    let commit = <Messages.CommitMessage> this.messages_[Type.Commit].value;
    let dhpart1 = <Messages.DHPartMessage> this.messages_[Type.DHPart1].value;
    let dhpart2 = <Messages.DHPartMessage> this.messages_[Type.DHPart2].value;
    let elems = {
      "hello_r.h3": hello_r.h3,
      "hello_r.hk": hello_r.hk,
      "hello_r.mac": hello_r.mac,
      "commit.h2": commit.h2,
      "commit.hk": commit.hk,
      "commit.clientVersion": commit.clientVersion,
      "commit.hvi": commit.hvi,
      "dhpart1.h1": dhpart1.h1,
      "dhpart1.pkey": dhpart1.pkey,
      "dhpart1.mac": dhpart1.mac,
      "dhpart2.h1": dhpart2.h1,
      "dhpart2.pkey": dhpart2.pkey,
      "dhpart2.mac": dhpart2.mac
    };
    log.debug("totalHash: keys to total_hash_buf: ", elems);
    let first_hash_buf = unbase64Concat(hello_r.h3, hello_r.hk, hello_r.mac,
                                              commit.h2, commit.hk);
    let cv_buf = new Buffer(commit.clientVersion);
    let second_hash_buf = unbase64Concat(commit.hvi, dhpart1.h1);
    let dh1k_buf = new Buffer(dhpart1.pkey);
    let third_hash_buf = unbase64Concat(dhpart1.mac, dhpart2.h1);
    let dh2k_buf = new Buffer(dhpart2.pkey);
    let fourth_hash_buf = unbase64Concat(dhpart2.mac);
    let total_hash_buf = Buffer.concat(
      [].concat( first_hash_buf, cv_buf, second_hash_buf, dh1k_buf,
                 third_hash_buf, dh2k_buf, fourth_hash_buf)
    );
    logBuffer("total_hash_buf", total_hash_buf);
    log.debug("totalHash: init-role: ", this.role_);
    log.debug("totalHash: hello_r: h3:", hello_r.h3, ", hk:",
              hello_r.hk, ", mac:", hello_r.mac);
    log.debug("totalHash: commit: h2: ", commit.h2, ", hk:",
              commit.hk, ", clientVersion:",
              commit.clientVersion, ", hvi:", commit.hvi);
    log.debug("totalHash: dhpart1: h1:", dhpart1.h1, ", pkey:",
              dhpart1.pkey, ", mac:", dhpart1.mac);
    log.debug("totalHash: dhpart2: h1:", dhpart2.h1, ", pkey:",
              dhpart2.pkey, ", mac:", dhpart2.mac);
    log.debug("totalHash: total_hash_buf: ", total_hash_buf);
    let hashed = crypto.createHash('sha256').update(total_hash_buf).digest();
    log.debug("totalHash: resulting hash is ", hashed);
    this.totalHash_ = hashed;
    return hashed;
  }

  // 'key' is a regular buffer, that we re-encode into a base64 string
  // for fullHmac.
  private kdf_(key :Buffer, label :string, context :Buffer,
               numbits :number) :Buffer{
    var oneBuf = new Buffer(4);
    var lenBuf = new Buffer(4);
    oneBuf.writeInt32BE(1, 0);
    lenBuf.writeInt32BE(numbits, 0);
    log.debug("kdf: key", key);
    log.debug("kdf: oneBuf", oneBuf);
    log.debug("kdf: label", label);
    log.debug("kdf: context", context.toString('hex'));
    log.debug("kdf: lenBuf", lenBuf);
    var b64Key = key.toString('base64');
    var zeroByte :Buffer= new Buffer(1);
    zeroByte.fill(0);
    var completeValue = Buffer.concat([ oneBuf, new Buffer(label), zeroByte, 
                                        Buffer.concat([context]), lenBuf]);
    var full_hmac = this.fullHmac_(b64Key, completeValue.toString('base64'));
    log.debug("kdf: full_hmac: ", full_hmac);
    return full_hmac.slice(0, Math.ceil(numbits / 8));
  }

  // key and value are both base64-encoded.
  private fullHmac_(key:string, value:string) :Buffer {
    let kBlockSize = 64;  // sha-256 block size is 512 bits - 64 bytes.
    let key_buf = new Buffer(key, 'base64');

    log.debug("fullHmac: key: ", key);
    log.debug("fullHmac: value: ", value);

    // Follow FIPS-198 quite literally.  I haven't found any docs on
    // createHmac(sha256,key) w.r.t. FIPS-198.
    if (key_buf.length > kBlockSize) {
      let hmac = crypto.createHash('sha256');
      hmac.update(key_buf);
      let hash_key = hmac.digest();
      let zerobuf = new Buffer(key_buf.length - kBlockSize);
      zerobuf.fill(0);
      key_buf = Buffer.concat([hmac.digest(), zerobuf], kBlockSize);
    } else if (key_buf.length < kBlockSize) {
      let zerobuf = new Buffer(kBlockSize - key_buf.length);
      zerobuf.fill(0);
      key_buf = Buffer.concat([key_buf, zerobuf], kBlockSize);
    }

    let strNBuffer = (s:Buffer) :string => { return s.toString(); }
    let xorBuffer = (buf:Buffer, value:number) :Buffer => {
      for (var i = 0; i < buf.length; i++) {
        buf.writeInt8(buf.readInt8(i) ^ (+value), i);
      }
      return buf;
    };

    let k_0 = Buffer.concat([key_buf]);
    logBuffer('fullHmac k_0', k_0);

    // ipad = 0x36.
    let kb_step4 = xorBuffer(Buffer.concat([k_0]), 0x36);
    logBuffer('fullHmac A', kb_step4);

    // Step 5
    let ki_text = Buffer.concat([kb_step4, new Buffer(value, 'base64')]);
    logBuffer('fullHmac B', ki_text);

    // Step 6
    let h_ki_text = crypto.createHash('sha256').update(ki_text).digest();
    logBuffer('fullHmac C', ki_text);

    // Step 7 - xor with 0x5c.
    let ko_text = xorBuffer(Buffer.concat([k_0]), 0x5c);
    logBuffer('fullHmac D', ko_text);

    // Step 8 - concat steps 7 and 6
    let ki_h_ko_text = Buffer.concat([ko_text, h_ki_text]);
    logBuffer('fullHmac E', ki_h_ko_text);

    // Final step: hash step 8.
    let full_hmac = crypto.createHash('sha256').update(ki_h_ko_text).digest();
    logBuffer('fullHmac F', full_hmac);
    return full_hmac;
  }

  // key is base64 encoded.  values are buffers.
  private mac_(key:string, ...values:Buffer[]) :string {
    let valueB64 = Buffer.concat(values).toString('base64');
    let full_hmac = this.fullHmac_(key, valueB64);
    let sliced = full_hmac.slice(0,2);
    let result = Buffer.concat([sliced]).toString('base64');
    log.debug("mac_(key <b64>:" + key + ", val <bin>:", values,
              "): full_hmac: " + hexify(full_hmac) + ", sliced: " +
              hexify(sliced) + ", result: " + result);
    return result;
  }

  private state_() :string {
    return "{" + Object.keys(this.messages_).map( (key: any, index:number) => {
      return Type[key];
    }).join(",") + "}";
  }
};
