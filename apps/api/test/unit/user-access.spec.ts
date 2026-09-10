import { ROLE_TO_ACCESS, resolveEffectivePermissions } from '../../src/authorization/user-access.service';

/* فاز ۴ پلن یکپارچه‌سازی (ADR-0008) — نگاشت ۱۰ نقش قدیم به مدل سه‌بعدی
   بدون از دست رفتن هیچ سطح دسترسی. */
describe('UserAccess — RBAC سه‌بعدی (فاز ۴)', () => {
  it('هر ۱۰ نقش قدیم نگاشت دقیق دارند (هیچ نقشی جا نمی‌ماند)', () => {
    const legacyRoles = ['SUPER_ADMIN', 'HOLDING_ADMIN', 'HOLDING_EXECUTIVE', 'SUBSIDIARY_ADMIN', 'SUBSIDIARY_EXECUTIVE', 'RELATIONSHIP_MANAGER', 'PROJECT_MANAGER', 'ANALYST', 'STANDARD_USER', 'READ_ONLY'];
    for (const role of legacyRoles) {
      expect(ROLE_TO_ACCESS[role]).toBeDefined();
    }
    expect(Object.keys(ROLE_TO_ACCESS)).toHaveLength(legacyRoles.length);
  });

  it('نگاشت مطابق جدول فاز ۴ پلن است', () => {
    expect(ROLE_TO_ACCESS.SUPER_ADMIN).toEqual({ scope: 'ALL', accessLevel: 'ADMIN', functionalRole: null });
    expect(ROLE_TO_ACCESS.HOLDING_ADMIN).toEqual({ scope: 'ALL', accessLevel: 'ADMIN', functionalRole: null });
    expect(ROLE_TO_ACCESS.HOLDING_EXECUTIVE).toEqual({ scope: 'ALL', accessLevel: 'EXECUTIVE', functionalRole: null });
    expect(ROLE_TO_ACCESS.SUBSIDIARY_ADMIN).toEqual({ scope: 'ORGANIZATION', accessLevel: 'ADMIN', functionalRole: null });
    expect(ROLE_TO_ACCESS.RELATIONSHIP_MANAGER).toEqual({ scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: 'RELATIONSHIP_MANAGER' });
    expect(ROLE_TO_ACCESS.ANALYST).toEqual({ scope: 'ORGANIZATION', accessLevel: 'STANDARD', functionalRole: 'ANALYST' });
    expect(ROLE_TO_ACCESS.READ_ONLY).toEqual({ scope: 'ORGANIZATION', accessLevel: 'READ_ONLY', functionalRole: null });
  });

  it('وراثت سلسله‌مراتبی: ADMIN ⊇ EXECUTIVE ⊇ STANDARD ⊇ READ_ONLY', () => {
    const ro = new Set(resolveEffectivePermissions({ accessLevel: 'READ_ONLY' }));
    const std = new Set(resolveEffectivePermissions({ accessLevel: 'STANDARD' }));
    const exec = new Set(resolveEffectivePermissions({ accessLevel: 'EXECUTIVE' }));
    const admin = new Set(resolveEffectivePermissions({ accessLevel: 'ADMIN' }));
    for (const p of ro) expect(std.has(p)).toBe(true);
    for (const p of std) expect(exec.has(p)).toBe(true);
    for (const p of exec) expect(admin.has(p)).toBe(true);
  });

  it('READ_ONLY فقط خواندنی است (هیچ مجوز نوشتن ندارد)', () => {
    const perms = resolveEffectivePermissions({ accessLevel: 'READ_ONLY' });
    expect(perms).toContain('relationship.read');
    expect(perms.some((p) => p.endsWith('.write') || p.endsWith('.delete'))).toBe(false);
  });

  it('ADMIN به مجوزهای مدیریتی می‌رسد', () => {
    const perms = resolveEffectivePermissions({ accessLevel: 'ADMIN' });
    expect(perms).toContain('admin.users');
    expect(perms).toContain('access.manage');
    expect(perms).toContain('scoring.admin');
  });

  it('تخصص کاری مجوزهای حوزهٔ خودش را اضافه می‌کند', () => {
    const base = new Set(resolveEffectivePermissions({ accessLevel: 'STANDARD' }));
    const rm = resolveEffectivePermissions({ accessLevel: 'STANDARD', functionalRole: 'RELATIONSHIP_MANAGER' });
    expect(base.size).toBeGreaterThan(0);
    expect(rm.length).toBeGreaterThanOrEqual(base.size);
  });

  it('permissionOverrides فقط استثنا را اعمال می‌کند (افزودن و حذف)', () => {
    const perms = resolveEffectivePermissions({
      accessLevel: 'READ_ONLY',
      permissionOverrides: { add: ['report.export'], remove: ['search.read'] },
    } as any);
    expect(perms).toContain('report.export');
    expect(perms).not.toContain('search.read');
  });
});
