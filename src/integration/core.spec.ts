/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

describe('uproxy core', function() {
  it('loads freedom module', (done) => {
    var uproxyModule = new freedom('scripts/build/compile-src/generic_core/freedom-module.json', {
    }).then(function(UProxy : () => void) {
      var uProxyAppChannel = new UProxy();
      uProxyAppChannel.on('ready', done);
    });
  });
});
