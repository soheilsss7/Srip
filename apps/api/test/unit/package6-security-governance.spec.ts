import { classificationAllows } from '../../src/common/authorization/authorization.service';

describe('Package 6 security governance contracts', () => {
  it('enforces classification ceilings', () => {
    expect(classificationAllows('CONFIDENTIAL', 'PUBLIC')).toBe(true);
    expect(classificationAllows('CONFIDENTIAL', 'CONFIDENTIAL')).toBe(true);
    expect(classificationAllows('CONFIDENTIAL', 'RESTRICTED')).toBe(false);
  });

  it('does not treat unknown requested classifications as safe', () => {
    expect(classificationAllows('INTERNAL', 'NOT_A_CLASSIFICATION')).toBe(false);
  });
});
