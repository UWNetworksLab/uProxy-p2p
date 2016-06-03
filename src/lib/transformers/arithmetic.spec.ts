/// <reference path='../../../../third_party/typings/browser.d.ts' />

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv();

import arithmetic = require('./arithmetic');
import arraybuffers = require('../arraybuffers/arraybuffers');
import decompression = require('./decompressionShaper');

const frequencies :number[] = decompression.sampleConfig().frequencies;
let encoder :arithmetic.Encoder;
let decoder :arithmetic.Decoder;

describe('Arithmetic coding and decoding - short inputs', function() {
  beforeEach(function() {
    encoder = new arithmetic.Encoder(frequencies);
    decoder = new arithmetic.Decoder(frequencies);
  });

  // The encoding input is a simple numerical sequence.
  // The encoding output is taken from a reference implementation.
  it('encoding short input', function() {
    let plain = new Buffer('00010203', 'hex');
    let target = new Buffer('ca0001020300000008', 'hex');
    let result = encoder.encode(plain);
    expect(arraybuffers.byteEquality(result, target)).toBe(true);
  });
  // The decoding input is taken from the output of the encoding test.
  // The decoding output is taken from the input of the encoding test.
  it('decoding short input', function() {
    let encoded = new Buffer('ca0001020300000008', 'hex');
    let target = new Buffer('00010203', 'hex');
    let result = decoder.decode(encoded).slice(0, -2);
    expect(arraybuffers.byteEquality(result, target)).toBe(true);
  });
});

describe('Arithmetic coding and decoding - long inputs', function() {
  beforeEach(function() {
    encoder = new arithmetic.Encoder(frequencies);
    decoder = new arithmetic.Decoder(frequencies);
  });

  // The encoding input is an example of a real WebRTC packet.
  // The encoding output is taken from a reference implementation.
  it('encoding long input', function() {
    let plain = new Buffer('0001005c2112a442484e436a4e475466373145420006002134474a396549694d755955354338496a3a697a7251347772576670316b57664464000000802900089a85cd9550c8ee0a002400046e7e1eff000800140345954222f0da663e8eb8cc79a1f7ba010fd50080280004e2284303', 'hex');
    let target = new Buffer('ca0001005c2112a442484e436a4e475466373145420006002134474a396549694d755955354338496a3a697a7251347772576670316b57664464000000802900089a85cd9550c8ee0a002400046e7e1eff000800140345954222f0da663e8eb8cc79a1f7ba010fd50080280004e228430300000074', 'hex');
    let encoded = encoder.encode(plain);
    expect(arraybuffers.byteEquality(encoded, target)).toBe(true);
  });
  // The decoding input is taken from the output of the encoding test.
  // The decoding output is taken from the input of the encoding test.
  it('decoding long input', function() {
    let encoded = new Buffer('ca0001005c2112a442484e436a4e475466373145420006002134474a396549694d755955354338496a3a697a7251347772576670316b57664464000000802900089a85cd9550c8ee0a002400046e7e1eff000800140345954222f0da663e8eb8cc79a1f7ba010fd50080280004e228430300000074', 'hex');
    let target = new Buffer('0001005c2112a442484e436a4e475466373145420006002134474a396549694d755955354338496a3a697a7251347772576670316b57664464000000802900089a85cd9550c8ee0a002400046e7e1eff000800140345954222f0da663e8eb8cc79a1f7ba010fd50080280004e2284303', 'hex');
    let decoded = decoder.decode(encoded).slice(0, -2);
    expect(arraybuffers.byteEquality(decoded, target)).toBe(true);
  });
})
