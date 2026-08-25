export const TAG_ENTITY_TYPES = [
  'Organization','Person','Relationship','Interaction','Meeting','Action','Commitment',
  'Project','Requirement','Opportunity','Recommendation','Document','Note','Workflow',
  'Referral','ConnectionPath','OrganizationUnit',
] as const;

export type TagEntityType = typeof TAG_ENTITY_TYPES[number];

export function isTagEntityType(value: string): value is TagEntityType {
  return (TAG_ENTITY_TYPES as readonly string[]).includes(value);
}
