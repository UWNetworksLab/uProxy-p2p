/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />
/// <reference path="logger.d.ts" />

describe("Core Logger", () => {
  var message1 = Logger.makeMessage('D', 'tag', 'simple string');
  var message3 = Logger.makeMessage('I', 'test-module', 'second string');
  var message4 = Logger.makeMessage('W', 'test', 'Bob pinged Alice with id=123456');
  var message5 = Logger.makeMessage('E', 'test', 'Bob pinged Alice with id=123456');
  var logger :Logger.Log;
  
  beforeEach(() => {
    logger = new Logger.Log();
    Logger.clearLogs();
  });

  it('formats string', () => {
    expect(Logger.formatMessage(message1))
        .toMatch(/D \[.*\] simple string/);
    expect(Logger.formatMessage(message3))
        .toMatch(/I \[.*\] second string/);
    expect(Logger.formatMessage(message4))
        .toMatch(/W \[.*\] Bob pinged Alice with id=123456/);
    expect(Logger.formatMessage(message5))
        .toMatch(/E \[.*\] Bob pinged Alice with id=123456/);
  });

  it('grab logs', () => {
    // testing default behavior, only log error messages.
    
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(Logger.getLogs().join('\n')).toMatch(
      /E \[.*\] third string/);

    // set to log all messages.
    Logger.clearLogs();
    Logger.setBufferedLogFilter(['*:D']);
    logger.debug('tag1', 'simple string');
    logger.info('tag1', 'second string');
    logger.error('tag1', 'third string');
    expect(Logger.getLogs().join('\n')).toMatch(
      /D \[.*\] simple string\nI \[.*\] second string\nE \[.*\] third string/);

     // set to log messages with level >= info.
    Logger.clearLogs();
    Logger.setBufferedLogFilter(['*:I']);
    logger.debug('tag1', 'simple string');
    logger.info('tag2', 'second string');
    logger.error('tag3', 'third string');
    expect(Logger.getLogs().join('\n')).toMatch(
      /I \[.*\] second string\nE \[.*\] third string/);

    // restore back to default.
    Logger.setBufferedLogFilter(['*:E']);
  });
});
