import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase 2 domain completion contract', () => {
  const root = join(__dirname, '../..');
  const read = (file: string) => readFileSync(join(root, file), 'utf8');

  it('covers the source Interaction/Meeting/Action/Commitment/Project/Opportunity contract', () => {
    const schema = read('prisma/schema.prisma');
    expect(schema).toContain('enum MeetingStatus');
    expect(schema).toContain('BLOCKED');
    expect(schema).toContain('reminderAt DateTime?');
    expect(schema).toContain('recommendationId String?');
    expect(read('src/interactions/interactions.service.ts')).toContain('publishInTransaction');
    expect(read('src/meetings/meetings.service.ts')).toContain('MeetingStatus.COMPLETED');
    expect(read('src/actions/actions.service.ts')).toContain('ActionDependency');
    expect(read('src/commitments/commitments.service.ts')).toContain('COMMITMENT_OVERDUE');
    expect(read('src/projects/projects.service.ts')).toContain('addRisk');
    expect(read('src/projects/projects.service.ts')).toContain('addMilestone');
    expect(read('src/opportunities/opportunities.service.ts')).toContain('OPPORTUNITY_STATUS_CHANGED');
  });

  it('keeps Prisma duplicate model declarations canonical', () => {
    const schema = read('prisma/schema.prisma');
    for (const model of ['ActionDependency','ProjectRisk','ProjectMilestone','ConnectionPath','Referral']) {
      expect((schema.match(new RegExp(`^model ${model} \\{`, 'gm')) ?? [])).toHaveLength(1);
    }
  });
});
