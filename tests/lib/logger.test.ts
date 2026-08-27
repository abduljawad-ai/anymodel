import { logger } from '../../src/lib/logger';

describe('logger', () => {
  beforeEach(() => {
    logger.clear();
  });

  test('logs messages at different levels', () => {
    logger.debug('debug message', 'TestContext');
    logger.info('info message', 'TestContext');
    logger.warn('warn message', 'TestContext');
    logger.error('error message', 'TestContext');

    const recent = logger.getRecent();
    expect(recent).toHaveLength(4);
    expect(recent[0].level).toBe('debug');
    expect(recent[1].level).toBe('info');
    expect(recent[2].level).toBe('warn');
    expect(recent[3].level).toBe('error');
  });

  test('includes timestamp', () => {
    logger.info('test message');
    const recent = logger.getRecent();
    expect(recent[0].timestamp).toBeDefined();
    expect(new Date(recent[0].timestamp)).toBeInstanceOf(Date);
  });

  test('includes context when provided', () => {
    logger.info('test message', 'MyContext');
    const recent = logger.getRecent();
    expect(recent[0].context).toBe('MyContext');
  });

  test('includes data when provided', () => {
    const testData = { key: 'value', count: 42 };
    logger.info('test message', 'TestContext', testData);
    const recent = logger.getRecent();
    expect(recent[0].data).toEqual(testData);
  });

  test('getRecent limits output', () => {
    for (let i = 0; i < 30; i++) {
      logger.info(`message ${i}`);
    }
    const recent = logger.getRecent(10);
    expect(recent).toHaveLength(10);
    expect(recent[0].message).toBe('message 20');
    expect(recent[9].message).toBe('message 29');
  });

  test('clear empties the buffer', () => {
    logger.info('message 1');
    logger.info('message 2');
    expect(logger.getRecent()).toHaveLength(2);
    logger.clear();
    expect(logger.getRecent()).toHaveLength(0);
  });

  test('maintains max buffer size', () => {
    // Fill buffer beyond max
    for (let i = 0; i < 150; i++) {
      logger.info(`message ${i}`);
    }
    const recent = logger.getRecent(100);
    expect(recent.length).toBeLessThanOrEqual(100);
  });
});
