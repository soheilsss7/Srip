import { Injectable } from '@nestjs/common';
import { CanonicalRelationshipScoreService } from '../scoring/relationship-score.service';
import { EntityResponseDto } from '../common/dto/entity-response.dto';

/**
 * Backward-compatible facade. Canonical calculation now lives in ScoringModule.
 * Existing relationship endpoints keep working without retaining a second formula.
 */
@Injectable()
export class RelationshipScoreService {
  constructor(private readonly canonical: CanonicalRelationshipScoreService) {}
  async recalculate(userId: string, id: string, reason = 'manual') {
    return this.canonical.calculate(userId, id, true);
  }
}
