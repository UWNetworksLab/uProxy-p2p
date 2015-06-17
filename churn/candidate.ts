/// <reference path='../../../third_party/freedom-typings/freedom-common.d.ts' />
/// <reference path='../../../third_party/freedom-typings/rtcpeerconnection.d.ts' />

import net = require('../net/net.types');

import RTCIceCandidate = freedom_RTCPeerConnection.RTCIceCandidate;

export interface IceExtension {
  key: string;
  value: string;
}

export class Candidate {
  public foundation: string;
  public component: number;
  public transport: string;
  public priority: number;
  public connectionAddress: string;
  public connectionPort: number;
  public type: string;
  public relAddress: string;
  public relPort: number;

  public extensions: IceExtension[] = [];

  public sdpMid: string;
  public sdpMLineIndex: number;

  public getLocalEndpoint() : net.Endpoint {
    if (this.type === 'host') {
      return {
        address: this.connectionAddress,
        port: this.connectionPort
      };
    } else if (this.type === 'srflx') {
      return {
        address: this.relAddress,
        port: this.relPort
      };
    } else {
      throw new Error('Unknown candidate type ' + this.type);
    }
  }

  public clone() : Candidate {
    var c = new Candidate();
    c.foundation = this.foundation;
    c.component = this.component;
    c.transport = this.transport;
    c.priority = this.priority;
    c.connectionAddress = this.connectionAddress;
    c.connectionPort = this.connectionPort;
    c.type = this.type;
    c.relAddress = this.relAddress;
    c.relPort = this.relPort;
    c.extensions = this.extensions.slice();
    c.sdpMid = this.sdpMid;
    c.sdpMLineIndex = this.sdpMLineIndex;
    return c;
  }

  public toRTCIceCandidate() : RTCIceCandidate {
    var candidateLine =
        'candidate:' + this.foundation +
        ' ' + this.component +
        ' ' + this.transport +
        ' ' + this.priority +
        ' ' + this.connectionAddress +
        ' ' + this.connectionPort +
        ' typ ' + this.type;

    if (typeof this.relAddress === 'string') {
      candidateLine +=
          ' raddr ' + this.relAddress +
          ' rport ' + this.relPort;
    }
    for (var ext in this.extensions) {
      candidateLine += ' ' + ext.key + ' ' + ext.value;
    }

    return {
      candidate: candidateLine,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex
    };
  }

  public static fromRTCIceCandidate(rtcIceCandidate:RTCIceCandidate)
      : Candidate {
    var makeNumber = (s:string) : number => {
      var ret = Number(s);
      if (isNaN(ret)) {
        throw new Error(s + ' is not a number');
      }
      return ret;
    };

    var tokens = rtcIceCandidate.candidate.split(' ');
    if (tokens.length < 8 || tokens[6] !== 'typ') {
      throw new Error('Invalid candidate: ' + rtcIceCandidate);
    }

    var c = new Candidate();
    c.foundation = tokens[0].split(':')[1];
    c.component = makeNumber(tokens[1]);
    c.transport = tokens[2].toLowerCase();
    c.priority = makeNumber(tokens[3]);
    c.connectionAddress = tokens[4];
    c.connectionPort = makeNumber(tokens[5]);
    c.type = tokens[7];

    if (tokens[8] === 'raddr') {
      c.relAddress = tokens[9];
      if (tokens[10] !== 'rport') {
        throw new Error('Missing rport: ' + rtcIceCandidate);
      }
      c.relPort = makeNumber(tokens[11]);
    }

    for (var i = 12; i < tokens.length; i += 2) {
      c.extensions.push({
        key: tokens[i],
        value: tokens[i + 1]
      });
    }

    return c;
  }
}

