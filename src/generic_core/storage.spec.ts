import * as freedomMocker from '../lib/freedom/mocks/mock-freedom-in-module-env';

import * as freedom_mocks from '../mocks/freedom-mocks';
declare var freedom: freedom.FreedomInModuleEnv;
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'core.storage': () => { return new freedom_mocks.MockFreedomStorage(); },
  'metrics': () => { return new freedom_mocks.MockMetrics(); },
  'pgp': () => { return new freedom_mocks.PgpProvider() },
  'portControl': () => { return new Object },
});

import * as local_storage from './storage';
import * as globals from './globals';
import storage = globals.storage;

// Depends on the MockFreedomStorage that executes everything synchronously.
describe('local_storage.Storage', () => {

  beforeEach(() => {
    spyOn(console, 'log');
  })

  it('starts with empty storage', (done) => {
    // Delay first test for 1 second, so that writes from previous tests have
    // time to complete, before we reset.  Without this, test cases from
    // social.spec.ts or local-instance.spec.ts can end up writing to storage
    // event after reset is complete - this is because they are testing
    // functionality which writes to storage (e.g. updating a user), but not
    // waiting for storage writes to be complete before calling done and
    // moving on to the next test.
    // TODO: change all test cases to wait on storage writes to be complete
    // before calling done, then we can remove this setTimeout hack.
    setTimeout(function() {
      storage.reset().then(() => {
        storage.keys().then((keys) => {
          expect(keys).toEqual([]);
        }).then(done);
      });
    }, 1000);
  });

  it('saves and loads to storage', (done) => {
    storage.save('birds', {
      'can': 'chirp'
    }).then(() => {
      storage.load('birds').then((result) => {
        expect(result).toEqual({
          'can': 'chirp'
        });
        storage.keys().then((keys) => {
          expect(keys).toEqual(['birds']);
        }).then(done);
      });
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
          storage.keys().then((keys) => {
            expect(keys).toEqual(['birds', 'cats']);
          }).then(done);
        });
      })
    });
  });

  it('rejects for non-existing keys', (done) => {
    storage.load('not-here').catch(done);
  });

  it('reset clears all keys', (done) => {
    var birdReject = false;
    var catReject = false;
    storage.reset().then(() => {
      var birds = storage.load('birds').catch((err) => {
        birdReject = true;
      });
      var cats = storage.load('cats').catch((err) => {
        catReject = true
      });
      return Promise.all([birds, cats]);
    }).then(() => {
      expect(birdReject).toEqual(true);
      expect(catReject).toEqual(true);
    }).then(done);
  });

});  // state-storage
