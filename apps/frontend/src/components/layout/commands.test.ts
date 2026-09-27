import { describe, expect, it } from 'vitest';
import { matchCommands, moveActive } from './commands';

const commands = [
  { id: '/', label: 'Dashboard', keywords: 'home overview' },
  { id: '/logs', label: 'Scrape Logs', keywords: 'attempts history' },
  { id: 'export', label: 'Export CSV', keywords: 'download scrape history' },
];

describe('matchCommands', () => {
  it('matches every typed word against label and keywords, in any case', () => {
    expect(matchCommands(commands, 'SCRAPE').map(c => c.id)).toEqual(['/logs', 'export']);
    expect(matchCommands(commands, 'history download').map(c => c.id)).toEqual(['export']);
    expect(matchCommands(commands, '  ')).toHaveLength(3);
    expect(matchCommands(commands, 'run full scrape')).toEqual([]);
  });
});

describe('moveActive', () => {
  it('wraps with the arrow keys and jumps with Home and End', () => {
    expect(moveActive(2, 'ArrowDown', 3)).toBe(0);
    expect(moveActive(0, 'ArrowUp', 3)).toBe(2);
    expect(moveActive(1, 'End', 3)).toBe(2);
    expect(moveActive(2, 'Home', 3)).toBe(0);
    expect(moveActive(0, 'ArrowDown', 0)).toBe(0);
  });
});
