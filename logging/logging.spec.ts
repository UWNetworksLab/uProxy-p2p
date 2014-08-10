/// <reference path='../third_party/typings/jasmine/jasmine.d.ts' />

describe("logger from core environment", () => {
  var log1 = new Logging.Log('tag1');
  var log2 = new Logging.Log('tag2');

  var message1 = Logging.makeMessage('D', 'tag', 'simple string', []);
  var message2 = Logging.makeMessage('D', 'tag', 'simple string');
  var message3 = Logging.makeMessage('I', 'test-module', 'second string', []);
  var message4 = Logging.makeMessage('W', 'test', '%1 pinged %2 with id=%3',
      ['Bob', 'Alice', '123456']);
  var message5 = Logging.makeMessage('E', 'test', '%1 pinged %2 with id=%3',
      ['Bob', 'Alice', '123456']);

  beforeEach(() => {
    Logging.clearLogs();
  });

  it('format string', () => {
    expect(Logging.formatMessage(message1))
        .toMatch(/\*D\[tag\]\(.*\): simple string/);
    expect(Logging.formatMessage(message2))
        .toMatch(/\*D\[tag\]\(.*\): simple string/);
    expect(Logging.formatMessage(message3))
        .toMatch(/\*I\[test-module\]\(.*\): second string/);
    expect(Logging.formatMessage(message4))
        .toMatch(/\*W\[test\]\(.*\): Bob pinged Alice with id=123456/);
    expect(Logging.formatMessage(message5))
        .toMatch(/\*E\[test\]\(.*\): Bob pinged Alice with id=123456/);
  });

  it('grab logs', () => {
    log1.debug('simple string');
    log2.info('second string');
    expect(Logging.getLogStrings().join('\n')).toMatch(
      /\*D\[tag1\]\(.*\): simple string\n\*I\[tag2\]\(.*\): second string/);
  });

  it('format message like printf', () => {
    log1.error('%1 pinged %2 with id=%3', ['Bob', 'Alice', '123456']);
    expect(Logging.getLogStrings().join('\n')).toMatch(
      /\*E\[tag1\]\(.*\): Bob pinged Alice with id=123456/);
  });
});
