import crypto = require('crypto');

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
  private ourPubKey_:string;
  private peerPubKey_:string;
  private ourHashes_:string[];
  private result_:Promise<void>;
  private delegate_:Delegate;
  private resolve_ : () => void;
  private reject_ : () => void;
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

  // Messages are existing messages received or sent in the
  // conversation.  Useful both for testing and for when this Verifier
  // is being created in response to a received message.
  constructor(ourPubKey: string,
              peerPubKey: string,
              delegate: Delegate,
              messages?: {[type:string]:Messages.Tagged},
              ourHashes?: string[],
              role?: number) {
    this.ourPubKey_ = ourPubKey;
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
      var type = msg.type;
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
        var hello1 = <Messages.HelloMessage>this.messages_[Type.Hello1].value;
        var hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        var dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
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
        var hvi = this.hashString((dhpart2.h1 + dhpart2.pkey + dhpart2.mac) + (
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
        var hello2 = <Messages.HelloMessage>this.messages_[Type.Hello2].value;
        if (hello2.hk !== this.hashString(msg.pkey)) {
          console.log("hash(pkey)/hk mismatch for DHPart1 (",msg.pkey,") vs Hello2 (",
                      hello2.hk, ")");
          this.resolve(false);
          return;
        }

        this.set(new Messages.Tagged(Type.DHPart1,
                            new Messages.DHPartMessage(msg.type, msg.h1, msg.pkey, msg.mac)));
        // TODO(mling): Calculate SAS and verify with user.
        var sas = "CALCULATE ME";
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
        var commit = <Messages.CommitMessage>this.messages_[Type.Commit].value;
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
        var sas = "CALCULATE ME";
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
        var dhpart1 = <Messages.DHPartMessage>this.messages_[Type.DHPart1].value;
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
        var dhpart2 = <Messages.DHPartMessage>this.messages_[Type.DHPart2].value;
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
    this.sendNextMessage();
    this.result_ = new Promise<void>(function (resolve, reject) {
      this.resolve_ = resolve;
      this.reject_ = reject;
    });
    return this.result_;
  }

  public sendNextMessage() {
    // Look at where we are in the conversation.
    // - figure out the latest message that isn't in the set.
    // - see if we have its prereq.
    // - send it.
    var msgType:Type;
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
      var msg = this.generate(msgType);
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
    var allKeys = Object.keys(msg);
    for (var k in allKeys) {
      if (msg[k].length == '') {
        console.log("Verify msg ", msg, " got empty value for key ", k);
        return false;
      }
    }
    // Verify that we only have the keys we're expecting.
    var type :string = msg.type.toString();
    if (allKeys.sort().join() !== KeyVerify.keyMap_[type]) {
      console.log("Verify msg ", msg, " bad key set.  Wanted ", 
                  KeyVerify.keyMap_[type], " got ", allKeys.sort().join());
      return false;
    }
    // Verify that we have all the prerequisite messages for this one.
    for (var m in KeyVerify.prereqMap_[type]) {
      if (!this.messages_[m]) {
        console.log("Verify msg ", msg, " missing prerequisite ", m);
        return false;
      }
    }
    return true;
  }
  private generateHashes() :[string] {
    return <[string]>[];
  }
  private generate(type: Type) :Messages.Tagged {
    throw "IMPLEMENT ME";
  }
  private set(message: Messages.Tagged) :boolean {
    if (this.messages_[message.type] !== null) {
      return false;
    } else {
      this.messages_[message.type] = message;
      return true;
    }
  }

  private mac(key:string, value:string) :string {
    return "FIX ME";
  }
};
