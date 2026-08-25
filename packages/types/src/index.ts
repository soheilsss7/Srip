export type OrganizationStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type RelationshipStatus = 'PROSPECTIVE' | 'ACTIVE' | 'AT_RISK' | 'DORMANT' | 'ARCHIVED';
export interface OrganizationSummary { id: string; name: string; type: string; status: OrganizationStatus; }
export interface RelationshipSummary { id: string; sourceOrganizationId: string; targetOrganizationId: string; status: RelationshipStatus; healthScore: number; strategicScore: number; }
