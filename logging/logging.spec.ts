/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="logging.d.ts" />

var freedom:any;

describe("Client Logging Shim", () => {
  it('forwards logs to freedom', (done) => {
      var log1 = new Logging.Log('tag1');
      setTimeout(() => {
        log1.error('string');

        expect(freedom.loggers.tag1).toBeDefined();
        expect(freedom.loggers.tag1.error).toHaveBeenCalledWith('string');
        expect(freedom.loggers.tag1.log).not.toHaveBeenCalledWith('string');
        done();
      }, 0);
  });

  it('Collapses arguments into flattened messages', (done) => {
      var log2 = new Logging.Log('tag2');
      setTimeout(() => {
        log2.info('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
        expect(freedom.loggers.tag2.info).toHaveBeenCalledWith('Bob pinged Alice with id=123456');
        done();
      }, 0);
  });
});
