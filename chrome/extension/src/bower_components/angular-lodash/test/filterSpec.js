describe('angular-lodash: Filter', function() {
  var simpleAdapList = [
    'map', 'collect',
    'reduce', 'inject', 'foldl',
    'reduceRight', 'foldr',
    'find', 'detect',
    'invoke',
    'pluck',
    'sortBy',
    'groupBy',
    'shuffle',
    'toArray',
    'size',
    'first', 'head',
    'initial',
    'last',
    'rest', 'tail',
    'compact',
    'flatten',
    'without',
    'union',
    'intersection',
    'difference',
    'zip',
    'indexOf',
    'lastIndexOf',
    'keys',
    'values',
    'functions', 'methods',
    'pick',
    'tap',
    'has',
    'uniqueId',
    'escape',
    'result',
    'template'
  ];

  beforeEach(module('_'));

  _.each(simpleAdapList, function(fnName) {
    it(fnName + " should adapt to lodash's "+ fnName,
      inject(function($filter) {
        expect($filter(fnName).toString()).toBe(_[fnName].toString());
    }));
  });

  var stooges = [{name : 'moe', age : 40}, {name : 'larry', age : 50}, {name : 'curly', age : 60}];
  
  it('min should return min number of number array',
    inject(function($filter) {
      expect($filter('min')(_.range(10))).toBe(0);
  }));

  it('min should return min object of object array with iterator',
    inject(function($filter) {
      expect($filter('min')(stooges, function(stooge){ return stooge.age; }))
      .toEqual({name : 'moe', age : 40});
  }));

  it('min should return min object of object array with predicate',
    inject(function($filter) {
      expect($filter('min')(stooges, 'age'))
      .toEqual({name : 'moe', age : 40});
  }));

  it('max should return max number of number array',
    inject(function($filter) {
      expect($filter('max')(_.range(10))).toBe(9);
  }));

  it('max should return max object of object array with iterator',
    inject(function($filter) {
      expect($filter('max')(stooges, function(stooge){ return stooge.age; }))
      .toEqual({name : 'curly', age : 60});
  }));

  it('max should return max object of object array with predicate',
    inject(function($filter) {
      expect($filter('max')(stooges, 'age'))
      .toEqual({name : 'curly', age : 60});
  }));

  it('sortedIndex should return index when insert value in a sorted collection',
    inject(function($filter) {
      expect($filter('sortedIndex')(_.range(10, 60, 10), 35)).toBe(3);
  }));

  var sortedCollection = _.map(_.range(10, 60, 10), function(value) {
    return {value: value, doubleValue: 2 * value};
  });
  it('sortedIndex should return index when insert value in a sorted collection with iterator',
    inject(function($filter) {
      expect($filter('sortedIndex')(sortedCollection, {value: 35, negValue: -35},
        function(obj) {return obj.value;}))
      .toBe(3);
  }));

  it('sortedIndex should return index when insert value in a sorted collection with iterator',
    inject(function($filter) {
      expect($filter('sortedIndex')(sortedCollection, {value: 35, doubleValue: 70},
        function(obj) {return obj.doubleValue;}))
      .toBe(3);
  }));

  it('sortedIndex should return index when insert value in a sorted collection with predicate',
    inject(function($filter) {
      expect($filter('sortedIndex')(sortedCollection, {value: 35, doubleValue: 70}, 'value'))
      .toBe(3);
  }));

  it('sortedIndex should return index when insert value in a sorted collection with predicate',
    inject(function($filter) {
      expect($filter('sortedIndex')(sortedCollection, {value: 35, doubleValue: 70}, 'doubleValue'))
      .toBe(3);
  }));

  it('uniq should be alias of unique', inject(function($filter) {
    expect($filter('uniq')).toBe($filter('unique'));
  }));

  it('uniq(unique) should return duplicate-free version of array',
    inject(function($filter) {
      expect($filter('uniq')([1, 2, 1, 3, 1, 4])).toEqual([1, 2, 3, 4]);
  }));

  it('uniq(unique) should return duplicate-free version of array with "isSorted" tip',
    inject(function($filter) {
      expect($filter('uniq')(_.sortBy([1, 2, 1, 3, 1, 4], function(n) {return n;}), true))
      .toEqual([1, 2, 3, 4]);
  }));

  var sin = function(num) {return Math.sin(num);};
  it('uniq(unique) should return duplicate-free version of array with "isSorted" tip and iterator',
    inject(function($filter) {
      expect($filter('uniq')(
        _.sortBy([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
          sin), true, sin))
      .toEqual([5, 4, 6, 3, 1, 2]);
  }));

  it('uniq(unique) should return duplicate-free version of array with iterator',
    inject(function($filter) {
      expect($filter('uniq')(
        _.sortBy([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6],
          sin), sin))
      .toEqual([5, 4, 6, 3, 1, 2]);
  }));

  it('filter should be alias of select', inject(function($filter) {
    expect($filter('filter')).toBe($filter('select'));
  }));
});
