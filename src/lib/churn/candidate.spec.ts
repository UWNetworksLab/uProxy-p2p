import * as candidate from './candidate';
import Candidate = candidate.Candidate;

describe('extractEndpointFromCandidateLine', function() {
  it('garbage test', () => {
    expect(function() {
      Candidate.fromRTCIceCandidate({candidate: 'abc def'});
    }).toThrow();
  });

  it('reject invalid port numbers', () => {
    expect(function() {
      Candidate.fromRTCIceCandidate({
        candidate: 'candidate:9097 1 udp 4175 xxx yyy typ host generation 0'
      });
    }).toThrow();
  });

  it('host candidate', () => {
    var rtcIceCandidate = {
      candidate: 'candidate:129713316 2 udp 2122129151 172.26.108.25 40762 typ host generation 0',
      sdpMid: '',
      sdpMLineIndex: 0
    }
    var c = Candidate.fromRTCIceCandidate(rtcIceCandidate);
    expect(c.foundation).toEqual('129713316');
    expect(c.component).toEqual(2);
    expect(c.protocol).toEqual('udp');
    expect(c.priority).toEqual(2122129151);
    expect(c.ip).toEqual('172.26.108.25');
    expect(c.port).toEqual(40762);
    expect(c.type).toEqual('host');
    expect(c.relatedAddress).toBeUndefined();
    expect(c.relatedPort).toBeUndefined();
    expect(c.extensions[0]).toEqual({key: 'generation', value: '0'});

    expect(c.getLocalEndpoint()).toEqual({
      address: '172.26.108.25',
      port: 40762
    });

    // Roundtrip
    expect(c.toRTCIceCandidate()).toEqual(rtcIceCandidate);
  });

  it('host candidate', () => {
    var rtcIceCandidate = {
      candidate: 'candidate:9097 1 udp 4175 ::1 50840 typ srflx raddr 2001:DB8::1 rport 56635',
      sdpMid: '',
      sdpMLineIndex: 0
    }
    var c = Candidate.fromRTCIceCandidate(rtcIceCandidate);
    expect(c.foundation).toEqual('9097');
    expect(c.component).toEqual(1);
    expect(c.protocol).toEqual('udp');
    expect(c.priority).toEqual(4175);
    expect(c.ip).toEqual('::1');
    expect(c.port).toEqual(50840);
    expect(c.type).toEqual('srflx');
    expect(c.extensions).toEqual([]);

    expect(c.getLocalEndpoint()).toEqual({
      address: '2001:DB8::1',
      port: 56635
    });

    // Roundtrip
    expect(c.toRTCIceCandidate()).toEqual(rtcIceCandidate);
  });

  it('relay candidate', () => {
    var c = Candidate.fromRTCIceCandidate({
      candidate: 'candidate:9097 1 udp 4175 127.0.0.1 50840 typ relay raddr 172.26.108.25 rport 56635'
    });
    expect(c.getLocalEndpoint).toThrow();
  });

  // Ensure TCP candidates don't cause a problem. See:
  //   http://tools.ietf.org/html/rfc6544
  it('tcp candidates', () => {
    var rtcIceCandidate = {
      candidate: 'candidate:1302982778 1 tcp 1518214911 172.29.18.131 0 typ host tcptype active generation 0',
      sdpMid: '',
      sdpMLineIndex: 0
    };
    var c = Candidate.fromRTCIceCandidate(rtcIceCandidate);
    expect(c.foundation).toEqual('1302982778');
    expect(c.component).toEqual(1);
    expect(c.protocol).toEqual('tcp');
    expect(c.priority).toEqual(1518214911);
    expect(c.ip).toEqual('172.29.18.131');
    expect(c.port).toEqual(0);
    expect(c.type).toEqual('host');
    expect(c.extensions[0]).toEqual({key: 'tcptype', value: 'active'});
    expect(c.extensions[1]).toEqual({key: 'generation', value: '0'});

    expect(c.getLocalEndpoint).toThrow();

    // Roundtrip
    expect(c.toRTCIceCandidate()).toEqual(rtcIceCandidate);
  });

  // Ensure un-whitelisted extensions are stripped:
  //   https://github.com/uProxy/uproxy/issues/2167
  it('un-whitelisted extensions are removed', () => {
    const rtcIceCandidate = {
      candidate: 'candidate:1302982778 1 tcp 1518214911 172.29.18.131 0 typ host generation 0 ufrag abc123',
      sdpMid: '',
      sdpMLineIndex: 0
    };
    const c = Candidate.fromRTCIceCandidate(rtcIceCandidate);
    expect(c.extensions.length).toEqual(1);
    expect(c.extensions[0]).toEqual({ key: 'generation', value: '0' });

    // Roundtrip, sanitised.
    expect(c.toRTCIceCandidate()).toEqual({
      candidate: 'candidate:1302982778 1 tcp 1518214911 172.29.18.131 0 typ host generation 0',
      sdpMid: '',
      sdpMLineIndex: 0
    });
  });
});
