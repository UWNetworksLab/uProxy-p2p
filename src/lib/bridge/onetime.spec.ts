/// <reference path='../../../third_party/typings/browser.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import mockFreedomRtcPeerConnection = require('../freedom/mocks/mock-rtcpeerconnection');
import onetime = require('./onetime');

interface Clown {
  name:string;
};

describe('signal batcher', function() {
  var m1 :Clown = {
    name: 'bozo'
  };
  var m2 :Clown = {
    name: 'coco'
  };
  var m3 :Clown = {
    name: ''
  };

  // Delimits batches by clowns with no name.
  var delimiter = (message:Clown) => {
    return message.name.length < 1;
  };

  it('simple encode/decode', (done) => {
    var batcher = new onetime.SignalBatcher<Clown>((encoded: string) => {
      var decoded = <Clown[]>onetime.decode(encoded);
      expect(decoded).toEqual([m1, m2]);
      done();
    }, delimiter);
    batcher.addToBatch(m1);
    batcher.addToBatch(m2);
    batcher.addToBatch(m3);
  });

  it('decode handles uncompressed signals', (done) => {
    var batcher = new onetime.SignalBatcher<Clown>((encoded: string) => {
      var decoded = <Clown[]>onetime.decode(encoded);
      expect(decoded).toEqual([m1, m2]);
      done();
    }, delimiter);
    batcher.addToBatch(m1);
    batcher.addToBatch(m2);
    batcher.addToBatch(m3);
  });

  it('compressed beats uncompressed', (done) => {
    let batcher = new onetime.SignalBatcher<Clown>(
        (uncompressedResult:string) => {
      let compressingBatcher = new onetime.SignalBatcher<Clown>(
          (compressedResult:string) => {
        expect(compressedResult.length < uncompressedResult.length);
        done();
      }, delimiter, true);
      compressingBatcher.addToBatch(m1);
      compressingBatcher.addToBatch(m2);
      compressingBatcher.addToBatch(m3);
    }, delimiter, false);
    batcher.addToBatch(m1);
    batcher.addToBatch(m2);
    batcher.addToBatch(m3);
  });
});
