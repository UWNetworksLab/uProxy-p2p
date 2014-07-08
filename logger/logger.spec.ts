/// <reference path='../../../node_modules/freedom-typescript-api/interfaces/freedom.d.ts' />
/// <reference path='../third_party/DefinitelyTyped/jasmine/jasmine.d.ts' />
/// <reference path='logger.ts' />

describe("logger", function() {
  var logger = new LoggerModule.LoggerImp('');

  beforeEach(function() {
    logger.reset();
  });

  it('format string', function() {
    expect(logger.format('D', 'tag', 'simple string', []))
        .toMatch(/.*\|tag\|D\|simple string/);
    expect(logger.format('I', 'test-module', 'second string', []))
        .toMatch(/.*\|test-module\|I\|second string/);

    expect(logger.format('W', 'test', '%1 pinged %2 with id=%3', [
                         'Bob', 'Alice', '123456']))
        .toMatch(/.*\|test\|W\|Bob pinged Alice with id=123456/);

  });

  it('grab logs', function() {
    logger.debug('tag', 'simple string');
    logger.info('test-module', 'second string');
    logger.getLogs().then((s) => {
        expect(s).toMatch(
            /.*\|tag\|D\|simple string\n.*\|test-module\|I\|second string/);
    });
  });

  it('format message like printf', function(){
    logger.error('test', '%1 pinged %2 with id=%3', 'Bob', 'Alice', '123456');
    logger.getLogs().then((s) => {
        expect(s).toMatch(/.*\|test\|E\|Bob pinged Alice with id=123456/);
    });
  });

});



