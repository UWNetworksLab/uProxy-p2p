/// <reference path='storage.ts' />
/// <reference path='../interfaces/lib/jasmine/jasmine.d.ts' />

declare var storage :Core.Storage;
Core.DEBUG_STATESTORAGE = false;

// Depends on the MockStorage that executes everything synchronously.
describe('Core.Storage', () => {

  it('saves and loads to storage', (done) => {
    storage.save('birds', {
      'can': 'chirp'
    }).then(() => {
      storage.load('birds').then((result) => {
        expect(result).toEqual({
          'can': 'chirp'
        });
      }).then(done);
    });
  });

  it('overrides old keys', (done) => {
    storage.save('birds', {
      'can': 'meow'
    }).then(() => {
      storage.load('birds').then((result) => {
        expect(result).toEqual({
          'can': 'meow'
        });
      }).then(done);
    });
  });

  it('saving independent key does not affect other keys', (done) => {
    storage.save('cats', {
      'actually': 'meow'
    }).then(() => {
      storage.load('birds').then((result) => {
        expect(result).toEqual({
          'can': 'meow'
        });
      }).then(() => {
        storage.load('cats').then((result) => {
          expect(result).toEqual({
            'actually': 'meow'
          });
        }).then(done);
      })
    });
  });

  it('loads undefined for non-existing keys', (done) => {
    storage.load('not-here').then((result) => {
      expect(result).not.toBeDefined();
    }).then(done);
  });

  it('uses default value for non-existing keys', (done) => {
    storage.load('not-here', 12345).then((result) => {
      expect(result).toEqual(12345);
    }).then(done);
  });

});  // state-storage
