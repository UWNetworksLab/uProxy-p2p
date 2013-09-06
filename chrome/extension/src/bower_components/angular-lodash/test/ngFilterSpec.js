/*The MIT License

Copyright (c) 2010-2012 Google, Inc. http://angularjs.org

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

'use strict';

describe('Filter: filter', function() {
  var filter;

  beforeEach(inject(function($filter){
    filter = $filter('filter');
  }));

  it('should filter by string', function() {
    var items = ['MIsKO', {name: 'shyam'}, ['adam'], 1234];
    expect(filter(items, '').length).toBe(4);
    expect(filter(items, undefined).length).toBe(4);

    expect(filter(items, 'iSk').length).toBe(1);
    expect(filter(items, 'isk')[0]).toBe('MIsKO');

    expect(filter(items, 'yam').length).toBe(1);
    expect(filter(items, 'yam')[0]).toEqual(items[1]);

    expect(filter(items, 'da').length).toBe(1);
    expect(filter(items, 'da')[0]).toEqual(items[2]);

    expect(filter(items, '34').length).toBe(1);
    expect(filter(items, '34')[0]).toBe(1234);

    expect(filter(items, "I don't exist").length).toBe(0);
  });

  it('should not read $ properties', function() {
    expect(''.charAt(0)).toBe(''); // assumption

    var items = [{$name: 'misko'}];
    expect(filter(items, 'misko').length).toBe(0);
  });

  it('should filter on specific property', function() {
    var items = [{ignore: 'a', name: 'a'}, {ignore: 'a', name: 'abc'}];
    expect(filter(items, {}).length).toBe(2);

    expect(filter(items, {name: 'a'}).length).toBe(2);

    expect(filter(items, {name: 'b'}).length).toBe(1);
    expect(filter(items, {name: 'b'})[0].name).toBe('abc');
  });

  it('should take function as predicate', function() {
    var items = [{name: 'a'}, {name: 'abc', done: true}];
    expect(filter(items, function(i) {return i.done;}).length).toBe(1);
  });

  it('should take object as perdicate', function() {
    var items = [{first: 'misko', last: 'hevery'},
                 {first: 'adam', last: 'abrons'}];

    expect(filter(items, {first:'', last:''}).length).toBe(2);
    expect(filter(items, {first:'', last:'hevery'}).length).toBe(1);
    expect(filter(items, {first:'adam', last:'hevery'}).length).toBe(0);
    expect(filter(items, {first:'misko', last:'hevery'}).length).toBe(1);
    expect(filter(items, {first:'misko', last:'hevery'})[0]).toEqual(items[0]);
  });

  it('should support negation operator', function() {
    var items = ['misko', 'adam'];

    expect(filter(items, '!isk').length).toBe(1);
    expect(filter(items, '!isk')[0]).toEqual(items[1]);
  });
});
