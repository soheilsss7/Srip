import { isCustomFieldEntityType, isCustomFieldType } from '../../src/custom-fields/custom-fields.types';

describe('Phase D custom field contract', () => {
  it('supports the documented typed values', () => {
    expect(isCustomFieldType('text')).toBe(true);
    expect(isCustomFieldType('number')).toBe(true);
    expect(isCustomFieldType('boolean')).toBe(true);
    expect(isCustomFieldType('date')).toBe(true);
    expect(isCustomFieldType('select')).toBe(true);
    expect(isCustomFieldType('multiselect')).toBe(true);
    expect(isCustomFieldType('unknown')).toBe(false);
  });
  it('restricts values to supported business entity types', () => {
    expect(isCustomFieldEntityType('Relationship')).toBe(true);
    expect(isCustomFieldEntityType('Organization')).toBe(true);
    expect(isCustomFieldEntityType('Person')).toBe(true);
    expect(isCustomFieldEntityType('UnknownEntity')).toBe(false);
  });
});
