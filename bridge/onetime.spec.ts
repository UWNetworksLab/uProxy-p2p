/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

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

  it('simple encode/decode', (done) => {
    // Delimits batches by clowns with no name.
    var batcher = new onetime.SignalBatcher<Clown>((encoded: string) => {
      var decoded = <Clown[]>onetime.decode(encoded);
      expect(decoded).toEqual([m1, m2]);
      done();
    }, (message:Clown) => {
      return message.name.length < 1;
    });
    batcher.addToBatch(m1);
    batcher.addToBatch(m2);
    batcher.addToBatch(m3);
  });
});
