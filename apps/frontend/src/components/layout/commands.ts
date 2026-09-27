// Matching and keyboard movement for the command palette.

export type PaletteCommand = { id: string; label: string; keywords: string };

// Every typed word must appear in the label or keywords.
export function matchCommands<T extends PaletteCommand>(commands: T[], query: string): T[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter(command => words.every(word => `${command.label} ${command.keywords}`.toLowerCase().includes(word)));
}

// Arrow keys wrap around; Home and End jump to the ends.
export function moveActive(index: number, key: string, count: number): number {
  if (count === 0) return 0;
  if (key === 'ArrowDown') return (index + 1) % count;
  if (key === 'ArrowUp') return (index - 1 + count) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return index;
}
