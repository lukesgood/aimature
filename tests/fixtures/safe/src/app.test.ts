import { handler } from './app';
test('trims', () => { expect(handler(' x ')).toBe('x'); });
