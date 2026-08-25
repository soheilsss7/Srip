import { z } from 'zod';
export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(200),
  type: z.string().trim().min(2).max(80).default('COMPANY'),
});
export const createRelationshipSchema = z.object({
  sourceOrganizationId: z.string().uuid(),
  targetOrganizationId: z.string().uuid(),
  relationshipType: z.string().min(2).max(80),
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateRelationshipInput = z.infer<typeof createRelationshipSchema>;
