export function toggleFinish(currentFinishes: string[], finishKey: string): string[] {
  if (currentFinishes.includes(finishKey)) {
    return currentFinishes.filter(f => f !== finishKey);
  }
  return [...currentFinishes, finishKey];
}
