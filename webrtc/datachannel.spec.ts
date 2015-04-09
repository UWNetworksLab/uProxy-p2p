/// <reference path='../../../third_party/typings/es6-promise/es6-promise.d.ts' />
/// <reference path='../../../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="../../../third_party/freedom-typings/rtcpeerconnection.d.ts" />

import MockFreedomRtcDataChannel = require('../freedom/mocks/mock-rtcdatachannel');

import freedomMocker = require('../freedom/mocks/mock-freedom-in-module-env');
freedom = freedomMocker.makeMockFreedomInModuleEnv({
  'rtcdatachannel': () => { return new MockFreedomRtcDataChannel(); }
});

import datachannel = require('./datachannel');

describe('DataChannel', function() {
  var mockRtcDataChannel :MockFreedomRtcDataChannel;

  beforeEach(function() {
    mockRtcDataChannel = new MockFreedomRtcDataChannel();
  });

  // Ensure that close() waits for all outgoing unsent messages to be sent:
  //   https://github.com/uProxy/uproxy/issues/1218
  it('close waits for all data to be sent', (done) => {
    // The core.rtcdatachannel is initially open.
    spyOn(mockRtcDataChannel, 'getReadyState').and.returnValue(
        Promise.resolve('open'));

    // Have core.rtcdatachannel emit an onclose event when its
    // close() method is invoked.
    var closeSpy = spyOn(mockRtcDataChannel, 'close').and.callFake(() => {
      mockRtcDataChannel.handleEvent('onclose');
    });

    // Pretend the core.rtcdatachannel is buffering a lot of data.
    // This will cause DataChannel to buffer sends.
    var getBufferedAmountSpy = spyOn(mockRtcDataChannel, 'getBufferedAmount');
    getBufferedAmountSpy.and.callFake(() => {
      // getBufferedAmountSpy.and.returnValue(Promise.resolve(0));
      return Promise.resolve(datachannel.PC_QUEUE_LIMIT);
    });

    var sendBufferSpy = spyOn(mockRtcDataChannel, 'sendBuffer');

    datachannel.createFromRtcDataChannel(mockRtcDataChannel).then(
        (channel:datachannel.DataChannel) => {
      channel.send({
        buffer: new Uint8Array([0, 1, 2]).buffer
      });

      channel.close();

      // At this point, our message should not yet have been sent.
      // Now that we've requested the channel be closed, "unblock" the
      // core.rtcdatachannel to drain the message queue.
      expect(sendBufferSpy).not.toHaveBeenCalled();
      getBufferedAmountSpy.and.returnValue(Promise.resolve(0));

      channel.onceClosed.then(() => {
        expect(sendBufferSpy).toHaveBeenCalled();
        done();
      });
    });
  });
});
