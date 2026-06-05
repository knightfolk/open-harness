export function formatNeedleCount(count: number): string {
  return `${count} forged needle${count === 1 ? '' : 's'}`;
}

if (process.argv.includes('--self-check')) {
  console.log(formatNeedleCount(3));
}
