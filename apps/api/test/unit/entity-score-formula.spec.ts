import { computeComposite, DEFAULT_FACTOR_WEIGHTS, ENTITY_SCORE_FORMULA_VERSION } from '../../src/entity-scores/entity-score.service';

/* فاز ۲ پلن یکپارچه‌سازی (ADR-0006) — فرمول امتیاز مرکب واحد
   رگرسیون: خروجی فرمول روی دادهٔ ثابت نباید تغییر کند. */
describe('EntityScore — computeComposite (فاز ۲)', () => {
  it('فرمول نسخه‌دار است و وزن‌های پیش‌فرض طبق پلن هستند', () => {
    expect(ENTITY_SCORE_FORMULA_VERSION).toBe('1.0.0-plan-phase2');
    expect(DEFAULT_FACTOR_WEIGHTS.health).toBe(0.25);
    expect(DEFAULT_FACTOR_WEIGHTS.risk).toBe(0.2);
    expect(DEFAULT_FACTOR_WEIGHTS.strategic).toBe(0.15);
    expect(DEFAULT_FACTOR_WEIGHTS.trust).toBe(0.15);
    expect(DEFAULT_FACTOR_WEIGHTS.engagement).toBe(0.1);
    const sum = Object.values(DEFAULT_FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('رابطهٔ سالمِ کم‌ریسک امتیاز بالا می‌گیرد', () => {
    const { composite, factors } = computeComposite({
      health: 90, risk: 10, strategic: 80, trust: 85, engagement: 70, influence: 60, opportunity: 65, resilience: 75,
    });
    // risk معکوس وارد می‌شود: value = 100 - 10 = 90
    expect(factors.risk.value).toBe(90);
    expect(factors.risk.inverted).toBe(true);
    expect(composite).toBeGreaterThan(80);
    // فرمول شفاف: میانگین وزنی
    const expected = 0.25 * 90 + 0.2 * 90 + 0.15 * 80 + 0.15 * 85 + 0.1 * 70 + 0.05 * 60 + 0.05 * 65 + 0.05 * 75;
    expect(composite).toBeCloseTo(Math.round(expected * 10) / 10, 5);
  });

  it('ریسک بالا امتیاز را پایین می‌آورد (معکوس)', () => {
    const low = computeComposite({ health: 80, risk: 10, strategic: 80, trust: 80, engagement: 80, influence: 80, opportunity: 80, resilience: 80 }).composite;
    const high = computeComposite({ health: 80, risk: 60, strategic: 80, trust: 80, engagement: 80, influence: 80, opportunity: 80, resilience: 80 }).composite;
    expect(high).toBeLessThan(low);
    expect(low - high).toBeCloseTo(0.2 * 50, 5); // فقط سهم وزنِ ریسک
  });

  it('مقادیر خارج از بازه clamp می‌شوند و خروجی بین ۰ تا ۱۰۰ است', () => {
    const { composite } = computeComposite({
      health: 150, risk: -20, strategic: 100, trust: 0, engagement: 50, influence: 50, opportunity: 50, resilience: 50,
    });
    expect(composite).toBeGreaterThanOrEqual(0);
    expect(composite).toBeLessThanOrEqual(100);
  });

  it('هر فاکتور با وزن و جهت در خروجی مستند می‌شود (هیچ فاکتوری گم نمی‌شود)', () => {
    const { factors } = computeComposite({
      health: 50, risk: 50, strategic: 50, trust: 50, engagement: 50, influence: 50, opportunity: 50, resilience: 50,
    });
    expect(Object.keys(factors).sort()).toEqual(['engagement', 'health', 'influence', 'opportunity', 'resilience', 'risk', 'strategic', 'trust']);
    for (const key of Object.keys(factors)) {
      expect(factors[key]).toHaveProperty('value');
      expect(factors[key]).toHaveProperty('weight');
    }
  });
});
