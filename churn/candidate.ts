/// <reference path='../../../third_party/freedom-typings/freedom.d.ts' />

import net = require('../net/net.types');

// Throughout this file "RTCIceCandidate" refers to the JSON structure
// produced and consumed by Freedom, not an actual browser
// RTCIceCandidate object.
import RTCIceCandidate = freedom.RTCPeerConnection.RTCIceCandidate;

export interface IceExtension {
  key: string;
  value: string;
}

// Represents an RTCIceCandidate object from the WebRTC spec:
//   http://www.w3.org/TR/webrtc/#rtcicecandidate-type
// This encapsulates a candidate as described in section 15.1 of the ICE RFC
//   (http://tools.ietf.org/html/rfc5245#section-15.1) like
//   "candidate:9097 1 udp 4175 127.0.0.1 50840 typ relay raddr 172.26.108.25 rport 56635"
// Names based on ORTC's latest version of RTCIceCandidate:
//   http://ortc.org/wp-content/uploads/2015/06/ortc.html#rtcicecandidate*
export class Candidate {
  public component: number;

  public foundation: string;
  public priority: number;
  public ip: string;
  public protocol: string;
  public port: number;
  public type: string;
  public relatedAddress: string;
  public relatedPort: number;

  public extensions: IceExtension[] = [];

  public sdpMid: string;
  public sdpMLineIndex: number;

  // Returns this candidate's bound address on a physical interface.
  public getLocalEndpoint() : net.Endpoint {
    if (this.type === 'host') {
      // The local endpoint of a host candidate is the same as its
      // public endpoint.
      return {
        address: this.ip,
        port: this.port
      };
    } else if (this.type === 'srflx') {
      // The local endpoint of a server-reflexive candidate is the
      // local port that was used to contact the STUN server.
      return {
        address: this.relatedAddress,
        port: this.relatedPort
      };
    } else {
      throw new Error('Unknown candidate type ' + this.type);
    }
  }

  public clone() : Candidate {
    var c = new Candidate();
    c.component = this.component;
    c.foundation = this.foundation;
    c.priority = this.priority;
    c.ip = this.ip;
    c.protocol = this.protocol;
    c.port = this.port;
    c.type = this.type;
    c.relatedAddress = this.relatedAddress;
    c.relatedPort = this.relatedPort;
    c.extensions = this.extensions.slice();
    c.sdpMid = this.sdpMid;
    c.sdpMLineIndex = this.sdpMLineIndex;
    return c;
  }

  public toRTCIceCandidate() : RTCIceCandidate {
    var candidateLine =
        'candidate:' + this.foundation +
        ' ' + this.component +
        ' ' + this.protocol +
        ' ' + this.priority +
        ' ' + this.ip +
        ' ' + this.port +
        ' typ ' + this.type;

    if (typeof this.relatedAddress === 'string') {
      candidateLine +=
          ' raddr ' + this.relatedAddress +
          ' rport ' + this.relatedPort;
    }
    this.extensions.forEach((ext:IceExtension) => {
      candidateLine += ' ' + ext.key + ' ' + ext.value;
    });

    return {
      candidate: candidateLine,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex
    };
  }

  public static fromRTCIceCandidate(rtcIceCandidate:RTCIceCandidate)
      : Candidate {
    var stringToNumber = (s:string) : number => {
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
    c.component = stringToNumber(tokens[1]);
    c.protocol = tokens[2].toLowerCase();
    c.priority = stringToNumber(tokens[3]);
    c.ip = tokens[4];
    c.port = stringToNumber(tokens[5]);
    c.type = tokens[7];

    var i = 8;
    if (tokens[8] === 'raddr') {
      c.relatedAddress = tokens[9];
      if (tokens[10] !== 'rport') {
        throw new Error('Missing rport: ' + rtcIceCandidate);
      }
      
      c.relatedPort = stringToNumber(tokens[11]);
      i = 12;
    }

    for (; i < tokens.length; i += 2) {
      c.extensions.push({
        key: tokens[i],
        value: tokens[i + 1]
      });
    }

    c.sdpMid = rtcIceCandidate.sdpMid;
    c.sdpMLineIndex = rtcIceCandidate.sdpMLineIndex;

    return c;
  }
}

