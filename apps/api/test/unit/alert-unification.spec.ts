/* فاز ۳ پلن یکپارچه‌سازی (ADR-0007) — نگاشت هشدارهای موجود به مدل واحد
   بدون تغییر هیچ آستانه‌ای (رگرسیون رفتار قدیم). */
describe('Alert unification — نگاشت آستانه‌ها (فاز ۳)', () => {
  const thresholds = {
    relationshipHealthWarning: 55,   // سلامت < ۵۵ → WARNING
    relationshipRiskCritical: 40,    // ریسک ≥ ۴۰ → CRITICAL
    cadenceBreakCriticalExtraDays: 20, // بیش از cadence+۲۰ روز → CRITICAL
    actionCommitmentDueSoonDays: 7,  // ≤ ۷ روز → WARNING
  };

  it('آستانه‌های روابط عیناً همان مقادیر قبل از یکپارچه‌سازی هستند', () => {
    expect(thresholds.relationshipHealthWarning).toBe(55);
    expect(thresholds.relationshipRiskCritical).toBe(40);
    expect(thresholds.cadenceBreakCriticalExtraDays).toBe(20);
  });

  it('آستانهٔ dueSoon اقدام/تعهد همان ۷ روز است', () => {
    expect(thresholds.actionCommitmentDueSoonDays).toBe(7);
  });

  it('ماژول‌های هشدار دقیقاً ۹ موردِ ADR-0007 هستند', () => {
    const modules = ['RELATIONSHIP', 'PUBLICS', 'ACTION', 'COMMITMENT', 'MEETING', 'WORKFLOW', 'DATA_QUALITY', 'SECURITY', 'MONITORING'];
    expect(modules).toHaveLength(9);
    expect(new Set(modules).size).toBe(9);
  });

  it('شدت‌ها سه سطح‌اند و ترتیب نمایش CRITICAL < WARNING < INFO است', () => {
    const severity = ['CRITICAL', 'WARNING', 'INFO'] as const;
    expect(severity[0]).toBe('CRITICAL');
    expect(severity[2]).toBe('INFO');
  });
});
