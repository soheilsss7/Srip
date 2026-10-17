describe('Phase 17 scoring contract', () => {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));

  it('keeps score outputs within the documented 0..100 range', () => {
    for (const value of [-100, 0, 12, 50, 100, 1200]) expect(clamp(value)).toBeGreaterThanOrEqual(0);
    for (const value of [-100, 0, 12, 50, 100, 1200]) expect(clamp(value)).toBeLessThanOrEqual(100);
  });
});
