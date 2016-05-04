/// <reference path='../../../third_party/typings/node/node.d.ts' />
import crypto = require('crypto');
import globals = require('./globals');
import logging = require('../../../third_party/uproxy-lib/logging/logging');
import loggingTypes = require('../../../third_party/uproxy-lib/loggingprovider/loggingprovider.types');
var log :logging.Log = new logging.Log('KeyVerify');

export interface Delegate {
  sendMessage(msg:any) :Promise<boolean>;
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

export class KeyVerify {
  // Only written by set(), after verifying the message.
  private messages_: {[type:string]:Messages.Tagged}; // indexed by Type.
  // Zero or 1.  role_ 0 sends Hello1.  role_ 1 sends Hello2.  Doesn't
  // determine who's sending 'Commit'.
  private role_:number;
  private ourKey_:freedom.PgpProvider.PublicKey;
  private peerPubKey_:string;
  private ourHashes_:string[];
  private result_:Promise<void>;
  private delegate_:Delegate;
  private resolve_ : () => void;
  private reject_ : () => void;

  private pgp_self_ :freedom.PgpProvider.PgpProvider;
//  private pgp_peer_ :freedom.PgpProvider.PgpProvider;
  private static kPgpPassword :string = '';
  private static kPgpUser :string = '<uproxy>';
  private static kClientVersion :string = '1.0';
  private static seqno :number = 1;
  private static emptyPreReq :Type[] = [];
  private static keyMap_ :{[type:string]:string}= {
    'Hello':'clientVersion,h3,hk,mac,type,version',
    'Commit':'clientVersion,h2,hk,hvi,mac,type',
    'DHPart1':'h1,mac,pkey,type',
    'DHPart2':'h1,mac,pkey,type',
    'Confirm1':'h0,mac,type',
    'Confirm2':'h0,mac,type',
    'Conf2Ack':'type'
  };
  private static prereqMap_ :{[msg:string]:[Type]} = {
    'Hello': <[Type]>[],
    'Commit':[Type.Hello1, Type.Hello2],
    'DHPart1':[Type.Commit],
    'DHPart2':[Type.DHPart1],
    'Confirm1':[Type.DHPart2],
    'Confirm2':[Type.Confirm1],
    'Conf2Ack':[Type.Confirm2]
  };

  private generatorMap_ : {[msg:string]:((type:Type) =>Messages.Tagged)} = {
    'Hello1': this.makeHello,
    'Hello2': this.makeHello
  };

  // Messages are existing messages received or sent in the
  // conversation.  Useful both for testing and for when this Verifier
  // is being created in response to a received message.
  constructor(ourPubKey: string,
              peerPubKey: string,
              delegate: Delegate,
              messages?: {[type:string]:Messages.Tagged},
              ourHashes?: string[],
              role?: number) {
//    this.ourPubKey_ = ourPubKey;
    this.peerPubKey_ = peerPubKey;
    this.delegate_ = delegate;
    if (messages === undefined) {
      // Beginning of conversation.
      this.messages_ = {};
      this.role_ = 0;
      this.ourHashes_ = this.generateHashes();
    } else {
      // Peer started conversation, or this is a resumption.
      this.messages_ = messages;
      this.role_ = role;
      // See if we're a resumption.
      if (ourHashes !== undefined) {
        this.ourHashes_ = ourHashes;
      } else {
        this.ourHashes_ = this.generateHashes();
      }
    }
  }

  private hashString(s:string) :string {
    return crypto.createHash('sha256').update(s).digest('base64');
  }

  public readMessage(msg:any) {
    if (msg['type'] && this.structuralVerify(msg)) {
      let type = msg.type;
      if (type == 'Hello') {
        // Validate this Hello message.
        if (msg.clientVersion !== "0.1" || msg.version !== "1.0") {
          console.log("Invalid Hello message (versions): ", msg);
          this.resolve(false);
          return;
        }
        this.set(new Messages.Tagged(
          this.role_ == 0? Type.Hello2 : Type.Hello1,
          new Messages.HelloMessage(msg.type, msg.version, msg.h3, msg.hk,
                                    msg.clientVersion, msg.mac)));

      } else if (type == 'Commit') {
        if (msg.clientVersion !== "0.1") {
          console.log("Invalid Commit message (clientVersion)", msg);
          this.resolve(false);
          return;
        }
        // Validate the Hello message's mac.
        let hello1 = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        let dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
        if (hello1.mac !== this.mac(msg.h2, hello1.h3 + hello1.hk + msg.clientVersion)) {
          console.log("MAC mismatch for Hello1 found. h2: ", msg.h2, " and Hello1: ", hello1);
          this.resolve(false);
          return;
        }
        // Validate that h3 is the hash of h2
        if (hello1.h3 !== this.hashString(msg.h2)) {
          console.log("Hash chain failure for h3: ", hello1.h3, " and h2: ", msg.h2);
          this.resolve(false);
          return;
        }
        // Check that the peer can be the initiato.
        if (this.role_ !== 1) {
          console.log("Currently, we only support that role 0 is initiator.");
          this.resolve(false);
          return;
        }
        // Check that hvi is correct.
        let hvi = this.hashString((dhpart2.h1 + dhpart2.pkey + dhpart2.mac) + (
          hello2.h3 + hello2.hk + hello2.mac));
        if (hvi !== msg.hvi) {
          console.log("hvi Mismatch in commit. Wanted: ", hvi, " got: ", msg);
          this.resolve(false);
          return;
        }
        this.set(new Messages.Tagged(Type.Commit,
                                    new Messages.CommitMessage(msg.type, msg.h2, msg.hk,
                                                              msg.clientVersion,
                                                              msg.hvi, msg.mac)));

      } else if (type == 'DHPart1') {
        // We don't have an h2 value to check the hello2 message.
        let hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (hello2.hk !== this.hashString(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart1 (",msg.pkey,") vs Hello2 (",
                      hello2.hk, ")");
          this.resolve(false);
          return;
        }

        this.set(new Messages.Tagged(Type.DHPart1,
                            new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey, msg.mac)));
        // TODO(mling): Calculate SAS and verify with user.
        let sas = "CALCULATE ME";
        // There's an explicit choice here to treat the primary failure
        // mode - a failed SAS verification, the same as an I/O error.
        // Attackers may just kill the connection to look like an I/O
        // error, so we don't want the users to be mislead by the user
        // interface messaging here.  Instead, let them try again and
        // be more careful about the numbers.  If the numbers don't
        // match up, they know that they're under attack.
        this.delegate_.showSAS(sas).then(function (result) {
          if (result) {
            this.sendNextMessage();
          } else {
            console.log("Failed SAS verification.");
            this.resolve(false);
          }
        });
        
      } else if (type == 'DHPart2') {
        // Verify that this is the sam ehk.
        let commit = <Messages.CommitMessage>this.messages_[Type.Commit].value;
        if (commit.hk !== this.hashString(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart2 (",msg.pkey,") vs Commit (",
                      commit.hk, ")");
          this.resolve(false);
          return;
        }
        // Verify the mac of the Commit.
        if (commit.mac !== this.mac(msg.h1, commit.h2 + commit.hk +
                                    commit.clientVersion + commit.hvi)) {
          console.log("MAC mismatch for Commit found. h1: ", msg.h1,
                      " and Commit: ", commit);
          this.resolve(false);
          return;
        }

        this.set(new Messages.Tagged(Type.DHPart2,
                            new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey,
                                              msg.mac)));
        // TODO(mling): Calculate SAS and verify with user.
        let sas = "CALCULATE ME";
        this.delegate_.showSAS(sas).then(function (result) {
          if (result) {
            this.sendNextMessage();
          } else {
            console.log("Failed SAS verification.");
            this.resolve(false);
          }
        });
      } else if (type == 'Confirm1') {
        // Validate DHpart1
        let dhpart1 = <Messages.DHPartMessage>this.messages_[Type.DHPart1].value;
        if (dhpart1.mac !== this.mac(msg.h0, dhpart1.h1 + dhpart1.pkey)) {
          console.log("MAC mismatch for DHPart1 found. h0: ", msg.h0,
                      " and DHPart1: ", dhpart1);
          this.resolve(false);
          return;
        }
        this.set(new Messages.Tagged(Type.Confirm1,
                                     new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));

      } else if (type == 'Comfirm2') {
        // Validate DHpart2
        let dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
        if (dhpart2.mac !== this.mac(msg.h0, dhpart2.h1 + dhpart2.pkey)) {
          console.log("MAC mismatch for DHPart2 found. h0: ", msg.h0,
                      " and DHPart2: ", dhpart2);
          this.resolve(false);
          return;
        }
        this.set(new Messages.Tagged(Type.Confirm2,
                                     new Messages.ConfirmMessage(msg.type, msg.h0, msg.mac)));
        this.resolve(true);

      } else if (type == 'Conf2Ack') {
        this.set(new Messages.Tagged(Type.Conf2Ack, new Messages.ConfAckMessage(msg.type)));
        this.resolve(true);
      }
      this.sendNextMessage();
    } else {
      // reject the message for member key mismatch.
      console.log("Invalid message received: ", msg);
    }
  }

  private resolve(res:boolean) {
    if (res) {
      this.resolve_();
    } else {
      this.reject_();
    }
  }

  public start() :Promise<void>{
    return this.loadKeys().then(function () {
      this.sendNextMessage();
      this.result_ = new Promise<void>(function (resolve, reject) {
        this.resolve_ = resolve;
        this.reject_ = reject;
      });
      return this.result_;
    });
  }

  private loadKeys() :Promise<void> {
    this.pgp_self_ = <freedom.PgpProvider.PgpProvider>globals.pgp;
//    this.pgp_peer_ = <freedom.PgpProvider.PgpProvider>freedom['pgp']();

    // our public key is globals.publicKey, but we need the fingerprint, so
    // import the one in globals here, and get the higher-level object here.
    return this.pgp_self_.exportKey().then((key:freedom.PgpProvider.PublicKey) => {
      this.ourKey_ = key;
      return Promise.resolve<void>();
    });
  }

  public sendNextMessage() {
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
      let msg = this.generate(msgType);
      this.set(msg);
      this.delegate_.sendMessage(msg).then(function(succeeded) {
        if (!succeeded) {
          console.log("Failed to send message in ZRTP message.  Resolving as failure.");
          this.resolve(false);
        }
      });
    }
  }

  private structuralVerify(msg:any) :boolean{
    // Verify that none of the values are blank.
    let allKeys = Object.keys(msg);
    for (let k in allKeys) {
      if (msg[k].length == '') {
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
    for (let m in KeyVerify.prereqMap_[type]) {
      if (!this.messages_[m]) {
        console.log("Verify msg ", msg, " missing prerequisite ", m);
        return false;
      }
    }
    return true;
  }


  private set(message: Messages.Tagged) :boolean {
    if (this.messages_[message.type] !== null) {
      return false;
    } else {
      this.messages_[message.type] = message;
      return true;
    }
  }

  // --- Begin Crypto Stuff --
  //
  // This is based off of ZRTP (RFC 6189), with keys that don't
  // expire, but no caching.
  private generateHashes() :[string] {
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

  private generate(type: Type) :Messages.Tagged {
    if (this.generatorMap_[type.toString()] !== undefined) {
      return this.generatorMap_[type.toString()](type);
    } else {
      throw ("generate(" + type.toString() + ") not yet implemented.");
    }
  }

  private makeHello(type: Type) :Messages.Tagged {
    let h3 = this.ourHashes_[0],
        hk = this.ourKey_.fingerprint.replace(/ /g, ''),
        mac = this.mac(this.ourHashes_[1],
                   h3 + hk + KeyVerify.kClientVersion);

    let message = new Messages.Tagged( type, new Messages.HelloMessage(
      type.toString(), '1.0', h3, hk, KeyVerify.kClientVersion, mac));

    return message;
  }

  private totalHash() :Buffer {
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
    return hashed;
  }

  // key and value are both base64-encoded.
  private fullHmac(key:string, value:string) :Buffer {
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
  private mac(key:string, value:string) :string {
    let valueB64 = new Buffer(value).toString('base64');
    let full_hmac = this.fullHmac(key, value);
    let result = new Buffer([full_hmac.slice(0,2)]).toString('base64');
    return result; 
  }
};
