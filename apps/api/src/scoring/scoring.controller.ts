import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CanonicalRelationshipScoreService } from './relationship-score.service';
import { OpportunityScoreService } from './opportunity-score.service';
import { RiskScoreService } from './risk-score.service';
import { ConnectorScoreService } from './connector-score.service';
import { NetworkScoreService } from './network-score.service';
import { PrismaService } from '../prisma/prisma.service';
import { ScoreVersioningService } from './score-versioning.service';

@Controller('scores')
@UseGuards(AuthGuard, AuthorizationGuard)
export class ScoringController {
  constructor(
    private readonly relationship: CanonicalRelationshipScoreService,
    private readonly opportunity: OpportunityScoreService,
    private readonly risk: RiskScoreService,
    private readonly connector: ConnectorScoreService,
    private readonly network: NetworkScoreService,
    private readonly prisma: PrismaService,
    private readonly versioning: ScoreVersioningService,
  ) {}

  @Post('relationship/:id/recalculate') @RequirePermission('relationship.write') relationshipScore(@Req() req: any, @Param('id') id: string) { return this.relationship.calculate(req.user.sub, id); }
  @Post('opportunity/:id/recalculate') @RequirePermission('opportunity.read') opportunityScore(@Req() req: any, @Param('id') id: string) { return this.opportunity.calculate(req.user.sub, id); }
  @Post('risk/relationship/:id/recalculate') @RequirePermission('relationship.write') riskScore(@Req() req: any, @Param('id') id: string) { return this.risk.calculate(req.user.sub, id); }
  @Post('connector/person/:id/recalculate') @RequirePermission('person.read') connectorScore(@Req() req: any, @Param('id') id: string) { return this.connector.calculate(req.user.sub, id); }
  @Post('network/organization/:id/recalculate') @RequirePermission('network.read') networkScore(@Req() req: any, @Param('id') id: string) { return this.network.calculate(req.user.sub, id); }

  @Get(':type/:subjectType/:subjectId/history') @RequirePermission('relationship.read') async history(@Param('type') type: string, @Param('subjectType') subjectType: string, @Param('subjectId') subjectId: string) {
    return this.prisma.score.findFirst({ where: { type: type.toUpperCase(), subjectType: subjectType.toUpperCase(), subjectId }, include: { snapshots: { orderBy: { createdAt: 'desc' }, take: 100 } } });
  }

  @Get('versions') @RequirePermission('scoring.admin')
  versions(@Req() req: any) {
    return this.versioning.list(req.user.sub);
  }

  @Post('versions') @RequirePermission('scoring.admin')
  createVersion(@Req() req: any, @Body() body: any) {
    return this.versioning.create(req.user.sub, body);
  }

  @Patch('versions/:id') @RequirePermission('scoring.admin')
  updateVersion(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.versioning.updateDraft(req.user.sub, id, body);
  }

  @Post('versions/:id/activate') @RequirePermission('scoring.admin')
  activateVersion(@Req() req: any, @Param('id') id: string) {
    return this.versioning.activate(req.user.sub, id);
  }

  @Post('versions/configure-industry') @RequirePermission('scoring.admin')
  configureIndustry(@Req() req: any, @Body() body: any) {
    return this.versioning.configureIndustry(req.user.sub, body);
  }

  @Get('versions/:id/calibrations') @RequirePermission('scoring.admin')
  calibrations(@Req() req: any, @Param('id') id: string) {
    return this.versioning.calibrations(req.user.sub, id);
  }

  @Post('versions/:id/calibrations') @RequirePermission('scoring.admin')
  addCalibration(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.versioning.addCalibration(req.user.sub, id, body);
  }
}
