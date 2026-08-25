export const CUSTOM_FIELD_TYPES = ['text','number','boolean','date','datetime','select','multiselect','email','url'] as const;
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number];

export const CUSTOM_FIELD_ENTITY_TYPES = [
  'Organization','Person','Relationship','Interaction','Meeting','Action','Commitment',
  'Project','Requirement','Opportunity','Recommendation','Document','Note','Workflow',
  'Referral','ConnectionPath','OrganizationUnit',
] as const;
export type CustomFieldEntityType = typeof CUSTOM_FIELD_ENTITY_TYPES[number];

export function isCustomFieldType(value: string): value is CustomFieldType {
  return (CUSTOM_FIELD_TYPES as readonly string[]).includes(value);
}
export function isCustomFieldEntityType(value: string): value is CustomFieldEntityType {
  return (CUSTOM_FIELD_ENTITY_TYPES as readonly string[]).includes(value);
}
