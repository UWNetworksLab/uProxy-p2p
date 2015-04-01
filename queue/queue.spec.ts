/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />

import queue = require('./queue');
import Queue = queue.Queue;

describe('Base Queue', function() {
  var queue :Queue<string>;

  beforeEach(() => {
    queue = new Queue<string>();
  });

  it('New queue has length = 0', function() {
    expect(queue.length).toBe(0);
  });

  it('3 items makes length = 3', function() {
    queue.push('A');
    queue.push('BB');
    queue.push('CCC');
    expect(queue.length).toBe(3);
  });

  it('3 items and then clearing makes length = 0', function() {
    queue.push('A');
    queue.push('BB');
    queue.push('CCC');
    while (queue.length > 0) {
      queue.shift();
    }
    expect(queue.length).toBe(0);
  });

  it('3 items come out in order', function() {
    queue.push('A');
    queue.push('BBB');
    queue.push('CCCCC');
    expect(queue.length).toBe(3);
    expect(queue.shift()).toEqual('A');
    expect(queue.length).toBe(2);
    expect(queue.shift()).toEqual('BBB');
    expect(queue.length).toBe(1);
    expect(queue.shift()).toEqual('CCCCC');
    expect(queue.length).toBe(0);
  });
});  // describe('Base Queue', ... )
