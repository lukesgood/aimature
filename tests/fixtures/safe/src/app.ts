export function handler(input: string): string {
  if (!input) throw new Error('input required');
  return input.trim();
}
