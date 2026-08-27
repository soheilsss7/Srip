import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase D schema contract', () => {
  const schema = readFileSync(join(__dirname, '../../prisma/schema.prisma'), 'utf8');
  const migration = readFileSync(join(__dirname, '../../prisma/migrations/20260203120000_phaseD_custom_fields/migration.sql'), 'utf8');
  it('defines CustomFieldValue with all typed storage columns and unique identity', () => {
    expect(schema).toContain('model CustomFieldValue');
    for (const field of ['stringValue String?', 'numberValue Decimal?', 'booleanValue Boolean?', 'dateValue DateTime?', 'jsonValue Json?']) expect(schema).toContain(field);
    expect(schema).toContain('@@unique([customFieldId, entityType, entityId])');
  });
  it('enforces exactly one value at the database layer', () => {
    expect(migration).toContain('CustomFieldValue_exactly_one_value_ck');
    expect(migration).toContain('= 1);');
  });
});
