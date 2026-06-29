import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/core/logger.js';

function cap() {
  const lines: string[] = [];
  return { lines, write: (s: string) => { lines.push(s); } };
}

describe('createLogger', () => {
  it('emits messages at or below the configured level only', () => {
    const c = cap();
    const log = createLogger({ level: 'warn', write: c.write });
    log.error('errm');
    log.warn('warnm');
    log.info('infom');
    log.debug('debugm');
    const text = c.lines.join('');
    expect(text).toContain('errm');
    expect(text).toContain('warnm');
    expect(text).not.toContain('infom');
    expect(text).not.toContain('debugm');
  });

  it('silent level emits nothing', () => {
    const c = cap();
    const log = createLogger({ level: 'silent', write: c.write });
    log.error('e');
    log.warn('w');
    expect(c.lines).toHaveLength(0);
  });

  it('includes an [aim] prefix, a level tag, and serialized meta', () => {
    const c = cap();
    const log = createLogger({ level: 'debug', write: c.write });
    log.info('hello', { layer: 'npm-audit', n: 3 });
    const line = c.lines[0];
    expect(line).toContain('[aim]');
    expect(line).toContain('INFO');
    expect(line).toContain('hello');
    expect(line).toContain('"layer":"npm-audit"');
    expect(line).toContain('"n":3');
    expect(line.endsWith('\n')).toBe(true);
  });

  it('omits the meta suffix when there is no metadata', () => {
    const c = cap();
    const log = createLogger({ level: 'info', write: c.write });
    log.info('bare');
    expect(c.lines[0]).toBe('[aim] INFO bare\n');
  });
});
