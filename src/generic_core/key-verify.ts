import crypto = require('crypto');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingTypes = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
var log :logging.Log = new logging.Log('KeyVerify');

export interface Delegate {
  sendMessage(msg:any) :Promise<void>;
  showSAS(sas:string) :Promise<boolean>;
};

export enum Type { Hello1, Hello2, Commit, DHPart1, DHPart2, Confirm1, Confirm2,
                   Conf2Ack };

export namespace Messages {
  export class HelloMessage {
    constructor(public type: string, public version: string, public h3: string,
                public hk: string, public clientVersion: string, public mac: string){}
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
      public value: HelloMessage|CommitMessage|DHPartMessage|ConfirmMessage|ConfAckMessage) {}
  };
};

class Hashes {
  public static h0 :number = 3;
  public static h1 :number = 2;
  public static h2 :number = 1;
  public static h3 :number = 0;
};

export class KeyVerify {
  // Only written by set(), after verifying the message.
  private messages_: {[type:string]:Messages.Tagged}; // indexed by Type.
  // Zero or 1.  role_ 0 sends Hello1.  role_ 1 sends Hello2.  Generally, it
  // shouldn't determine who's sending 'Commit', but right now, we only support
  // role_ == 0 sending Commit.
  private role_:number;
  private ourKey_:freedom.PgpProvider.PublicKey;
  private peerPubKey_:string;
  private ourHashes_:string[];
  private result_:Promise<void>;
  private delegate_:Delegate;
  private resolvePromise_ : () => void;
  private rejectPromise_ : () => void;

  private pgp_ :freedom.PgpProvider.PgpProvider;
  // Data that requires expensive calculations to make.  These are a innately
  // hackey, and I don't like them.
  private s0_ :Buffer = null;
  private totalHash_ :Buffer = null;

  private static kPgpPassword :string = '';
  private static kPgpUser :string = '<uproxy>';
  private static kClientVersion :string = '1.0';
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

  private generatorMap_ : {[msg:string]:((type:Type) =>Messages.Tagged)};

  // Messages are existing messages received or sent in the
  // conversation.  Useful both for testing and for when this Verifier
  // is being created in response to a received message.
  constructor(peerPubKey: string,
              delegate: Delegate,
              messages?: {[type:string]:Messages.Tagged},
              role?: number,
              ourHashes?: string[]) {
    this.peerPubKey_ = peerPubKey;
    this.delegate_ = delegate;
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
      if (ourHashes !== undefined) {
        this.ourHashes_ = ourHashes;
      } else {
        this.ourHashes_ = this.generateHashes_();
      }
    }

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

  private hashString_(s:string) :string {
    return crypto.createHash('sha256').update(s).digest('base64');
  }

  // Create a Messages.Tagged from an arbitrary message.  Designed for
  // receiving Hello1 messages without the client having to know about
  // them.
  public static readFirstMessage(msg:any) : {[type:string]:Messages.Tagged} {
    if (msg['type'] && KeyVerify.structuralVerify_(msg) && msg.type == 'Hello1') {
      if (msg.clientVersion !== "0.1" || msg.version !== "1.0") {
        console.log("Invalid Hello message (versions): ", msg);
        return null;
      }
      var result :{[type:string]:Messages.Tagged};
      result[msg.type] = new Messages.Tagged(
        Type.Hello1, new Messages.HelloMessage(msg.type, msg.version, msg.h3, msg.hk,
                                               msg.clientVersion, msg.mac));
      return result;
    }
  }

  public readMessage(msg:any) {
    if (msg['type'] && KeyVerify.structuralVerify_(msg) && this.protoVerify_(msg)) {
      let type = msg.type;
      if (type == 'Hello1' || type == 'Hello2') {
        // Validate this Hello message.
        if (msg.clientVersion !== "0.1" || msg.version !== "1.0") {
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
        }
        this.set_(new Messages.Tagged(
          rawType,
          new Messages.HelloMessage(msg.type, msg.version, msg.h3, msg.hk,
                                    msg.clientVersion, msg.mac)));

      } else if (type == 'Commit') {
        if (msg.clientVersion !== "0.1") {
          console.log("Invalid Commit message (clientVersion)", msg);
          this.resolve_(false);
          return;
        }
        // Validate the Hello message's mac.
        let hello1 = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        let dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
        if (hello1.mac !== this.mac_(msg.h2, hello1.h3 + hello1.hk + msg.clientVersion)) {
          console.log("MAC mismatch for Hello1 found. h2: ", msg.h2, " and Hello1: ", hello1);
          this.resolve_(false);
          return;
        }
        // Validate that h3 is the hash of h2
        if (hello1.h3 !== this.hashString_(msg.h2)) {
          console.log("Hash chain failure for h3: ", hello1.h3, " and h2: ", msg.h2);
          this.resolve_(false);
          return;
        }
        // Check that the peer can be the initiato.
        if (this.role_ !== 1) {
          console.log("Currently, we only support that role 0 is initiator.");
          this.resolve_(false);
          return;
        }
        // Check that hvi is correct.
        let hvi = this.hashString_((dhpart2.h1 + dhpart2.pkey + dhpart2.mac) + (
          hello2.h3 + hello2.hk + hello2.mac));
        if (hvi !== msg.hvi) {
          console.log("hvi Mismatch in commit. Wanted: ", hvi, " got: ", msg);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(Type.Commit,
                                    new Messages.CommitMessage(msg.type, msg.h2, msg.hk,
                                                              msg.clientVersion,
                                                              msg.hvi, msg.mac)));

      } else if (type == 'DHPart1') {
        // We don't have an h2 value to check the hello2 message.
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (hello2.hk !== this.hashString_(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart1 (",msg.pkey,") vs Hello2 (",
                      hello2.hk, ")");
          this.resolve_(false);
          return;
        }

        this.set_(new Messages.Tagged(Type.DHPart1,
                            new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey, msg.mac)));

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
        if (commit.hk !== this.hashString_(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart2 (",msg.pkey,") vs Commit (",
                      commit.hk, ")");
          this.resolve_(false);
          return;
        }
        // Verify the mac of the Commit.
        if (commit.mac !== this.mac_(msg.h1, commit.h2 + commit.hk +
                                    commit.clientVersion + commit.hvi)) {
          console.log("MAC mismatch for Commit found. h1: ", msg.h1,
                      " and Commit: ", commit);
          this.resolve_(false);
          return;
        }

        this.set_(new Messages.Tagged(Type.DHPart2,
                            new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey,
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
        if (dhpart1.mac !== this.mac_(msg.h0, dhpart1.h1 + dhpart1.pkey)) {
          console.log("MAC mismatch for DHPart1 found. h0: ", msg.h0,
                      " and DHPart1: ", dhpart1);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(Type.Confirm1,
                                     new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));

      } else if (type == 'Comfirm2') {
        // Validate DHpart2
        let dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
        if (dhpart2.mac !== this.mac_(msg.h0, dhpart2.h1 + dhpart2.pkey)) {
          console.log("MAC mismatch for DHPart2 found. h0: ", msg.h0,
                      " and DHPart2: ", dhpart2);
          this.resolve_(false);
          return;
        }
        this.set_(new Messages.Tagged(Type.Confirm2,
                                     new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));
        this.resolve_(true);

      } else if (type == 'Conf2Ack') {
        this.set_(new Messages.Tagged(Type.Conf2Ack, new Messages.ConfAckMessage(msg.type)));
        this.resolve_(true);
      }
      this.sendNextMessage();
    } else {
      // reject the message for member key mismatch.
      console.log("Invalid message received: ", msg);
    }
  }

  private resolve_(res:boolean) {
    console.log("resolve("+res+")");
    if (res) {
      this.resolvePromise_();
    } else {
      this.rejectPromise_();
    }
  }

  public start() :Promise<void>{
    console.log("start() starting.");
    return this.loadKeys_().then(() => {
      console.log("start() callback invoked.");
      this.sendNextMessage();
      this.result_ = new Promise<void>((resolve:any, reject:any) => {
        console.log("start(): initializing result_.");
        this.resolvePromise_ = resolve;
        this.rejectPromise_ = reject;
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

  public sendNextMessage() {
    console.log("sendNextMessage(): starting.");
    // Look at where we are in the conversation.
    // - figure out the latest message that isn't in the set.
    // - see if we have its prereq.
    // - send it.
    let msgType:Type;
    if (this.role_ == 0) {
      if (this.messages_[Type.Conf2Ack]) {
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
    if (!this.messages_[msgType]) {
      let msg = this.generate_(msgType);
      this.set_(msg);
      this.delegate_.sendMessage(msg.value).catch((e) => {
        console.log("Failed to send message in ZRTP message.  Resolving as failure.", e);
        this.resolve_(false);
      });
    }
  }

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

  private protoVerify_ (msg:any) :boolean {
    let type :string = msg.type.toString();
    for (let m in KeyVerify.prereqMap_[type]) {
      let t = KeyVerify.prereqMap_[type][m];
      if (!this.messages_[Type[m]]) {
        console.log("Verify msg ", msg, " missing prerequisite ", m);
        return false;
      }
    }
    return true;
  } 

  private set_(message: Messages.Tagged) :boolean {
    if (this.messages_[message.type] !== null) {
      return false;
    } else {
      this.messages_[message.type] = message;
      return true;
    }
  }

  private generate_(type: Type) :Messages.Tagged {
    if (this.generatorMap_[Type[type]] !== undefined) {
      return this.generatorMap_[Type[type]](type);
    } else {
      console.log("generate(" + type + "<" + Type[type] + ">): can't generate this type.");
      throw (new Error("generate(" + Type[type] + ") not yet implemented."));
    }
  }

  private makeHello_ =  (type: Type) :Messages.Tagged => {
    console.log("makeHello(" + type + " <" + Type[type] + ">)");
    let h3 = this.ourHashes_[Hashes.h3],
        hk = this.ourKey_.fingerprint.replace(/ /g, ''),
        mac = this.mac_(this.ourHashes_[Hashes.h2],
                   h3 + hk + KeyVerify.kClientVersion);

    let message = new Messages.Tagged( type, new Messages.HelloMessage(
      Type[type], '1.0', h3, hk, KeyVerify.kClientVersion, mac));

    return message;
  }

  private makeDHPart_ = (type:Type) :Messages.Tagged => {
    if (type !== (this.role_ == 0 ? Type.DHPart2 : Type.DHPart1)) {
      throw (new Error("makeDHPart: Bad type " + Type[type] + " for role " + this.role_));
    }
    let h1 = this.ourHashes_[Hashes.h1];
    let pkey = this.ourKey_.key;
    let mac = this.mac_(this.ourHashes_[Hashes.h0], h1 + pkey);
    let message = new Messages.Tagged(type, new Messages.DHPartMessage(
      Type[type], h1, pkey, mac));
    return message;
  }

  private makeCommit_ = (type:Type) :Messages.Tagged => {
    if (this.role_ !== 0 || type != Type.Commit) {
      throw (new Error("makeCommit: only supports making Commit messages " +
                       "with role 0 being initiator."));
    }
    let dhpart2Msg = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
    let dhpart2 = dhpart2Msg.h1 + dhpart2Msg.pkey + dhpart2Msg.mac;
    let hello_obj = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
    let hello = hello_obj.h3 + hello_obj.hk + hello_obj.mac;
    let hvi = crypto.createHash('sha256').update(dhpart2 + hello).digest('base64');
    let h2 = this.ourHashes_[Hashes.h2];
    let hk = crypto.createHash('sha256').update(this.ourKey_.key).digest('base64');
    let version = '0.1';
    return new Messages.Tagged(Type.Commit, new Messages.CommitMessage(
      Type.Commit.toString(), h2, hk, KeyVerify.kClientVersion, hvi,
      this.mac_(this.ourHashes_[Hashes.h1], h2+hk+version+hvi)));
  }

  private makeConfirm_ = (type:Type) :Messages.Tagged => {
    if (this.s0_ === null) {
      throw (new Error("Cannot make Confirm message without s0 already calculated."));
    }
    if (type !== Type.Confirm1 && type !== Type.Confirm2) {
      throw (new Error("makeConfirm cannot make " + Type[type] + " messages"));
    }
    let h0 = this.ourHashes_[Hashes.h0];
    return new Messages.Tagged(type, new Messages.ConfirmMessage(
      Type[type], h0, this.mac_(this.s0_.toString('base64'), h0)));
  }

  private makeConf2Ack_ = (type:Type) :Messages.Tagged => {
    if (type !== Type.Conf2Ack) {
      throw (new Error("makeConf2Ack can only make Conf2Ack."));
    }
    return new Messages.Tagged(type, new Messages.ConfAckMessage('Conf2Ack'));
  };

  // --- Begin Crypto Stuff --
  //
  // This is based off of ZRTP (RFC 6189), with keys that don't
  // expire, but no caching.
  private generateHashes_() :[string] {
    let h0Hash =crypto.createHash('sha256'),
        h1Hash =crypto.createHash('sha256'),
        h2Hash =crypto.createHash('sha256'),
        h3Hash =crypto.createHash('sha256');
    h0Hash.update(new Date().toISOString() + '--' + KeyVerify.seqno);
    KeyVerify.seqno++;
    let h0 = h0Hash.digest();
    h1Hash.update(h0);
    let h1 = h1Hash.digest();
    h2Hash.update(h1);
    let h2 = h2Hash.digest();
    h3Hash.update(h2);
    let h3 = h3Hash.digest();
    return [h3.toString('base64'), h2.toString('base64'),
            h1.toString('base64'), h0.toString('base64')];
  }

  private calculateS0_() :Promise<Buffer> {
    if (this.s0_ !== null) {
      return Promise.resolve<Buffer>(this.s0_);
    }
    return this.pgp_.ecdhBob('P_256', this.peerPubKey_).then(
      (result:ArrayBuffer) => {
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
        log.debug("s0_inputs: result:", resultBuffer.toString());
        log.debug("s0_inputs: total_hash:", total_hash);
        log.debug("so_inputs: beOne:", beOne);
        log.debug("so_inputs: be64Zero:", be64Zero);
        log.debug("so_inputs: beZero:", beZero);

        let s0 = crypto.createHash('sha256').update(s0_input).digest();
        log.debug("s0: ", s0);
        return Promise.resolve<Buffer>(s0);
      });
  }

  private calculateSAS_() :Promise<number> {
    return this.calculateS0_().then(
      (s0:Buffer) => {
        let be64Zero = new Buffer(8),
            beZero = new Buffer(4),
            beOne = new Buffer(4);
        be64Zero.fill(0);
        beZero.fill(0);
        beOne.writeInt32BE(1,0);
        let total_hash = this.calculateTotalHash_();
        let kdf_context = Buffer.concat([ be64Zero, be64Zero, total_hash ]);
        log.debug("kdf_context: ", kdf_context);
        // RFC6189-4.5.2
        let sashash = this.kdf_(s0, "SAS", kdf_context, 256);
        log.debug("sashash: ", sashash);
        let sasvalue = sashash.slice(0, 4);
        log.debug("sasvalue: ", sasvalue);
        let sasHumanInt :number = sasvalue.slice(0,2).readUInt16BE(0);
        return Promise.resolve<number>(sasHumanInt);
    });
  }

  private calculateTotalHash_() :Buffer {
    if (this.totalHash_ !== null) {
      return this.totalHash_;
    }
    let hello_r :Messages.HelloMessage;
    if (this.role_ == 0) {
      hello_r = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
    } else {
      hello_r = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
    }

    let commit = <Messages.CommitMessage> this.messages_[Type.Commit].value;
    let dhpart1 = <Messages.DHPartMessage> this.messages_[Type.DHPart1].value;
    let dhpart2 = <Messages.DHPartMessage> this.messages_[Type.DHPart2].value;
    let total_hash_buf = Buffer.concat([
      new Buffer([hello_r.h3]), new Buffer([hello_r.hk]), new Buffer([hello_r.mac]),
      new Buffer([commit.h2]), new Buffer([commit.hk]), new Buffer([commit.clientVersion]),
      new Buffer([commit.hvi]),
      new Buffer([dhpart1.h1]), new Buffer([dhpart1.pkey]), new Buffer([dhpart1.mac]),
      new Buffer([dhpart2.h1]), new Buffer([dhpart2.pkey]), new Buffer([dhpart2.mac])
    ]);
    log.debug("totalHash: init-role: ", this.role_);
    log.debug("totalHash: hello_r: h3:", hello_r.h3, ", hk:", hello_r.hk, ", mac:", hello_r.mac);
    log.debug("totalHash: commit: h2: ", commit.h2, ", hk:", commit.hk, ", clientVersion:",
                commit.clientVersion, ", hvi:", commit.hvi);
    log.debug("totalHash: dhpart1: h1:", dhpart1.h1, ", pkey:", dhpart1.pkey, ", mac:", dhpart1.mac);
    log.debug("totalHash: dhpart2: h1:", dhpart2.h1, ", pkey:", dhpart2.pkey, ", mac:", dhpart2.mac);

    let hashed = crypto.createHash('sha256').update(total_hash_buf).digest();
    this.totalHash_ = hashed;
    return hashed;
  }

  // 'key' is a regular buffer, that we re-encode into a base64 string for fullHmac.
  private kdf_(key :Buffer, label :string, context :Buffer, numbits :number) :Buffer{
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
                                        new Buffer([context]), lenBuf]);
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

    let k_0 = new Buffer([key_buf]);
    log.debug('fullHmac k_0:', strNBuffer(k_0));

    // ipad = 0x36.
    let kb_step4 = xorBuffer(new Buffer([k_0]), 0x36);
    log.debug('fullHmac A:',strNBuffer(kb_step4));

    // Step 5
    let ki_text = Buffer.concat([kb_step4, new Buffer(value, 'base64')]);
    log.debug('fullHmac B:',strNBuffer(ki_text));

    // Step 6
    let h_ki_text = crypto.createHash('sha256').update(ki_text).digest();
    log.debug('fullHmac C:',h_ki_text);

    // Step 7 - xor with 0x5c.
    let ko_text = xorBuffer(new Buffer([k_0]), 0x5c);
    log.debug('fullHmac D:',strNBuffer(ko_text));

    // Step 8 - concat steps 7 and 6
    let ki_h_ko_text = Buffer.concat([ko_text, h_ki_text]);
    log.debug('fullHmac E:',strNBuffer(ki_h_ko_text));

    // Final step: hash step 8.
    let full_hmac =crypto.createHash('sha256').update(ki_h_ko_text).digest();
    log.debug('fullHmac F:',full_hmac);

    return full_hmac;
  }

  // key is base64-encoded.  value is an arbitrary string.
  private mac_(key:string, value:string) :string {
    let valueB64 = new Buffer(value).toString('base64');
    let full_hmac = this.fullHmac_(key, value);
    let result = new Buffer([full_hmac.slice(0,2)]).toString('base64');
    return result; 
  }
};
