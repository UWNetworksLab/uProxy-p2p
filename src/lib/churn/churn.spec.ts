/// <reference path='../../../third_party/typings/index.d.ts' />

import * as freedomMocker from '../freedom/mocks/mock-freedom-in-module-env';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import * as churn from './churn';
import * as net from '../net/net.types';

import * as candidate from './candidate';
import Candidate = candidate.Candidate;

describe('filterCandidatesFromSdp', function() {
  it('with candidates', () => {
    var sdp = 'o=- 3055156452807570418 3 IN IP4 127.0.0.1\n' +
              'a=group:BUNDLE audio data\n' +
              'a=rtcp:40762 IN IP4 172.26.108.25\n' +
              'a=candidate:9097 1 udp 4175 127.0.0.1 50840 typ relay raddr 172.26.108.25 rport 56635\n' +
              'a=candidate:129713316 2 udp 2122129151 172.26.108.25 40762 typ host generation 0\n' +
              'a=ice-ufrag:ETnQpTTSTgfXZ6HZ\n';
    expect(churn.filterCandidatesFromSdp(sdp)).toEqual(
        'o=- 3055156452807570418 3 IN IP4 127.0.0.1\n' +
        'a=group:BUNDLE audio data\n' +
        'a=rtcp:40762 IN IP4 172.26.108.25\n' +
        'a=ice-ufrag:ETnQpTTSTgfXZ6HZ\n');
  });
});


describe('selectBestPublicAddress', function() {
  var srflxEndpoint :net.Endpoint = {
    address: '172.26.108.25',
    port: 40762
  };

  var baseEndpoint :net.Endpoint = {
    address: '192.168.0.28',
    port: 56635
  };

  var publicEndpoint :net.Endpoint = {
    address: '18.19.20.21',
    port: 10011
  };

  var srflxCandidate = Candidate.fromRTCIceCandidate({
    candidate: 'a=candidate:129713316 2 udp 2122129151 ' +
      srflxEndpoint.address + ' ' + srflxEndpoint.port + ' typ srflx raddr ' +
      baseEndpoint.address + ' rport ' + baseEndpoint.port + ' generation 0'
  });

  var hostCandidate = Candidate.fromRTCIceCandidate({
    candidate: 'a=candidate:9097 1 udp 4175 ' + baseEndpoint.address + ' ' +
        baseEndpoint.port + ' typ host generation 0'
  });

  var publicHostCandidate = Candidate.fromRTCIceCandidate({
    candidate: 'a=candidate:1234321 1 udp 4567 ' + publicEndpoint.address + ' ' +
        publicEndpoint.port + ' typ host generation 0'
  });

  var relayCandidate = Candidate.fromRTCIceCandidate({
    candidate: 'a=candidate:9097 1 udp 4175 127.0.0.1 50840 typ relay ' +
        'raddr 172.26.108.25 rport 56635 generation 0'
  });

  it('reject relay candidates', () => {
    expect(function() {
      churn.selectBestPublicAddress([relayCandidate]);
    }).toThrow();
  });

  it('process srflx correctly', () => {
    var endpoint = churn.selectBestPublicAddress([srflxCandidate]);
    expect(endpoint).toEqual({
      internal: baseEndpoint,
      external: srflxEndpoint
    });
  });

  it('prefer srflx', () => {
    var correctNatPair = {
      internal: baseEndpoint,
      external: srflxEndpoint
    };

    var natPair = churn.selectBestPublicAddress([srflxCandidate, hostCandidate,
        relayCandidate]);
    expect(natPair).toEqual(correctNatPair);

    natPair = churn.selectBestPublicAddress([hostCandidate, relayCandidate,
        srflxCandidate]);
    expect(natPair).toEqual(correctNatPair);
  });

  it('use host if srflx is absent', () => {
    var correctNatPair = {
      internal: baseEndpoint,
      external: baseEndpoint
    };

    var natPair = churn.selectBestPublicAddress([hostCandidate, relayCandidate]);
    expect(natPair).toEqual(correctNatPair);

    natPair = churn.selectBestPublicAddress([hostCandidate, relayCandidate]);
    expect(natPair).toEqual(correctNatPair);
  });

  it('use public host if it is present', () => {
    var correctNatPair = {
      internal: publicEndpoint,
      external: publicEndpoint
    };

    var natPair = churn.selectBestPublicAddress(
        [hostCandidate, relayCandidate, srflxCandidate, publicHostCandidate]);
    expect(natPair).toEqual(correctNatPair);
  });
});
