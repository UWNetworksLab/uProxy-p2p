/// <reference path='../../../../third_party/typings/index.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import caesar = require('./caesar');

describe('caesar cipher', function() {
  var transformer :caesar.CaesarCipher;

  beforeEach(function() {
    transformer = new caesar.CaesarCipher();
  });

  function setKey(shift:number) : void {
    transformer.configure(JSON.stringify(<caesar.Config>{
      key: shift
    }));
  }

  it('transform', function() {
    setKey(4);
    expect(transformer.transformByte(0)).toEqual(4);
  });

  it('transform with wrap-around', function() {
    setKey(4);
    expect(transformer.transformByte(254)).toEqual(2);
  });

  it('restore', function() {
    setKey(1);
    expect(transformer.restoreByte(10)).toEqual(9);
  });

  it('restore with wrap-around', function() {
    setKey(7);
    expect(transformer.restoreByte(2)).toEqual(251);
  });

  it('transform buffer', function() {
    setKey(1);
    var bytes = new Uint8Array([4, 1, 255]);
    var result = new Uint8Array(transformer.transform(bytes.buffer)[0]);
    // toEquals() doesn't work for Uint8Array.
    expect(result[0]).toEqual(5);
    expect(result[1]).toEqual(2);
    expect(result[2]).toEqual(0);
  });

  it('restore buffer', function() {
    var input = new Uint8Array([4, 1, 255]);

    setKey(1);
    var output = new Uint8Array(transformer.restore(
        transformer.transform(new Uint8Array([4, 1, 255]).buffer)[0])[0]);

    for (var i = 0; i < output.length; i++) {
      expect(output[i]).toEqual(input[i]);
    }
  });
});
