function fiveRandomDigits(): string {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

export function generateUniqueId(existingIds: Iterable<string>, prefix: string): string {
  const seen = new Set(existingIds);
  for (let i = 0; i < 50; i++) {
    const candidate = `${prefix}${fiveRandomDigits()}`;
    if (!seen.has(candidate)) return candidate;
  }
  throw new Error(`Could not generate a unique ID with prefix ${prefix}`);
}
