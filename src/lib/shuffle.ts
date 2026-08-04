// `array.sort(() => Math.random() - 0.5)` is a common but genuinely biased
// way to shuffle - the result distribution depends on the sort algorithm's
// comparison pattern, not a uniform permutation. Fisher-Yates is correct.
export function shuffle<T>(pool: T[]): T[] {
  const result = [...pool];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
