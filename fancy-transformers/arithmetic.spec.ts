/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import arithmetic = require('./arithmetic');
import arraybuffers = require('../arraybuffers/arraybuffers');

// Make a sample distribution where all probabilities are equal.
function makeUniformProbabilities() :number[] {
  let probs :number[] = [];
  for(let index = 0; index<256; index++) {
    probs[index] = 1;
  }

  return probs;
}

describe('Arithmetic coding and decoding - short inputs', function() {
  it('Encode(0.1.2.3)==ca.0.1.2.3.0.0.0.8', function() {
    let plain = arraybuffers.hexStringToArrayBuffer("0.1.2.3");
    let target = arraybuffers.hexStringToArrayBuffer("ca.0.1.2.3.0.0.0.8");
    let encoder = new arithmetic.Encoder(makeUniformProbabilities());
    let result = encoder.encode(plain);
    expect(arraybuffers.byteEquality(result, target)).toBe(true);
  });
  it('Decode(ca.0.1.2.3.0.0.0.8)==0.1.2.3', function() {
    let encoded = arraybuffers.hexStringToArrayBuffer("ca.0.1.2.3.0.0.0.8");
    let target = arraybuffers.hexStringToArrayBuffer("0.1.2.3");
    let decoder = new arithmetic.Decoder(makeUniformProbabilities());
    let result = decoder.decode(encoded);
    expect(arraybuffers.byteEquality(result, target)).toBe(true);
  });
});

describe('Arithmetic coding and decoding - long inputs', function() {
  it('encode(0.1.0.5c...43.3)==ca.0.1.0.5c...0.74', function() {
    let plain = arraybuffers.hexStringToArrayBuffer("0.1.0.5c.21.12.a4.42.48.4e.43.6a.4e.47.54.66.37.31.45.42.0.6.0.21.34.47.4a.39.65.49.69.4d.75.59.55.35.43.38.49.6a.3a.69.7a.72.51.34.77.72.57.66.70.31.6b.57.66.44.64.0.0.0.80.29.0.8.9a.85.cd.95.50.c8.ee.a.0.24.0.4.6e.7e.1e.ff.0.8.0.14.3.45.95.42.22.f0.da.66.3e.8e.b8.cc.79.a1.f7.ba.1.f.d5.0.80.28.0.4.e2.28.43.3");
    let target = arraybuffers.hexStringToArrayBuffer("ca.0.1.0.5c.21.12.a4.42.48.4e.43.6a.4e.47.54.66.37.31.45.42.0.6.0.21.34.47.4a.39.65.49.69.4d.75.59.55.35.43.38.49.6a.3a.69.7a.72.51.34.77.72.57.66.70.31.6b.57.66.44.64.0.0.0.80.29.0.8.9a.85.cd.95.50.c8.ee.a.0.24.0.4.6e.7e.1e.ff.0.8.0.14.3.45.95.42.22.f0.da.66.3e.8e.b8.cc.79.a1.f7.ba.1.f.d5.0.80.28.0.4.e2.28.43.3.0.0.0.74");
    let encoder = new arithmetic.Encoder(makeUniformProbabilities());
    let encoded = encoder.encode(plain);
    expect(arraybuffers.byteEquality(encoded, target)).toBe(true);
  });
  it('decode(ca.0.1.0.5c...0.74)==0.1.0.5c...43.3', function() {
    let encoded = arraybuffers.hexStringToArrayBuffer("ca.0.1.0.5c.21.12.a4.42.48.4e.43.6a.4e.47.54.66.37.31.45.42.0.6.0.21.34.47.4a.39.65.49.69.4d.75.59.55.35.43.38.49.6a.3a.69.7a.72.51.34.77.72.57.66.70.31.6b.57.66.44.64.0.0.0.80.29.0.8.9a.85.cd.95.50.c8.ee.a.0.24.0.4.6e.7e.1e.ff.0.8.0.14.3.45.95.42.22.f0.da.66.3e.8e.b8.cc.79.a1.f7.ba.1.f.d5.0.80.28.0.4.e2.28.43.3.0.0.0.74");
    let target = arraybuffers.hexStringToArrayBuffer("0.1.0.5c.21.12.a4.42.48.4e.43.6a.4e.47.54.66.37.31.45.42.0.6.0.21.34.47.4a.39.65.49.69.4d.75.59.55.35.43.38.49.6a.3a.69.7a.72.51.34.77.72.57.66.70.31.6b.57.66.44.64.0.0.0.80.29.0.8.9a.85.cd.95.50.c8.ee.a.0.24.0.4.6e.7e.1e.ff.0.8.0.14.3.45.95.42.22.f0.da.66.3e.8e.b8.cc.79.a1.f7.ba.1.f.d5.0.80.28.0.4.e2.28.43.3");
    let decoder = new arithmetic.Decoder(makeUniformProbabilities());
    let decoded = decoder.decode(encoded);
    expect(arraybuffers.byteEquality(decoded, target)).toBe(true);
  });
})
