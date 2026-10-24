/** Public Relationship response contract. Sensitive fields are conditionally
 * populated by RelationshipPresenter after resource and field authorization. */
export interface RelationshipResponseDto {
  id: string;
  sourceOrganizationId: string;
  targetOrganizationId: string;
  relationshipType: string;
  relationshipTypeRef?: unknown;
  status: unknown;
  lifecycleStage: unknown;
  healthScore: number;
  strategicScore: number;
  riskScore: number;
  trustScore: number;
  accessScore: number;
  influenceScore: number;
  opportunityScore: number;
  resilienceScore: number;
  engagementScore: number;
  sensitivity: unknown;
  ownerId?: string | null;
  backupOwnerId?: string | null;
  reviewCadenceDays: number;
  lastInteractionAt?: Date | null;
  nextReviewAt?: Date | null;
  nextActionAt?: Date | null;
  sourceOrganization?: unknown;
  targetOrganization?: unknown;
  owner?: unknown;
  backupOwner?: unknown;
  scoreSnapshots?: unknown;
  interactions?: unknown;
  meetings?: unknown;
  projects?: unknown;
  recommendations?: unknown;
  tags?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
  notes?: unknown;
  strategicAssessment?: unknown;
  risk?: unknown;
  internalOpinion?: unknown;
  sensitiveContacts?: unknown;
}
