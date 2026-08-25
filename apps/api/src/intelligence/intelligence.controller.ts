import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IntelligenceService } from './intelligence.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('intelligence')
@UseGuards(AuthGuard, AuthorizationGuard)
export class IntelligenceController {
  constructor(private readonly service: IntelligenceService) {}
  @Get('relationships/:id/explain') @RequirePermission('relationship.read') explain(@Req() req: any, @Param('id') id: string) { return this.service.explain(req.user.sub, id); }
  @Post('relationships/:id/recalculate') @RequirePermission('relationship.write') recalculate(@Req() req: any, @Param('id') id: string, @Query('reason') reason?: string) { return this.service.recalculate(req.user.sub, id, reason); }
  @Get('relationships/:id/history') @RequirePermission('relationship.read') history(@Req() req: any, @Param('id') id: string, @Query('limit') limit?: string) { return this.service.history(req.user.sub, id, Number(limit ?? 30)); }
  @Get('risk-signals') @RequirePermission('relationship.read') riskSignals(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.service.riskSignals(req.user.sub, organizationId); }
  @Get('score-versions') @RequirePermission('relationship.read') scoreVersions(@Req() req: any) { return this.service.scoreVersions(req.user.sub); }
  @Post('score-versions') @RequirePermission('relationship.write') createScoreVersion(@Req() req:any, @Body() body:any) { return this.service.createScoreVersion(req.user.sub, String(body.name), body.weights ?? {}, body.notes); }
  @Post('score-versions/:id/activate') @RequirePermission('relationship.write') activateScoreVersion(@Req() req:any, @Param('id') id:string) { return this.service.activateScoreVersion(req.user.sub, id); }
  @Post('score-calibrations') @RequirePermission('relationship.write') calibrate(@Req() req:any, @Body() body:any) { return this.service.calibrate(req.user.sub, String(body.scoreVersionId), body.relationshipId, String(body.observedOutcome), Number(body.expectedScore), Number(body.observedScore), body.notes); }
  @Get('score-calibrations/:versionId/summary') @RequirePermission('relationship.read') calibrationSummary(@Req() req:any, @Param('versionId') versionId:string) { return this.service.calibrationSummary(req.user.sub, versionId); }
  @Get('opportunity-detection') @RequirePermission('relationship.read') opportunityDetection(@Req() req:any, @Query('organizationId') organizationId?:string) { return this.service.opportunityDetection(req.user.sub, organizationId); }
  @Get('strategic-coverage') @RequirePermission('relationship.read') strategicCoverage(@Req() req:any, @Query('organizationId') organizationId?:string) { return this.service.strategicCoverage(req.user.sub, organizationId); }
  @Get('network') @RequirePermission('network.read') networkIntelligence(@Req() req:any, @Query('organizationId') organizationId?:string) { return this.service.networkIntelligence(req.user.sub, organizationId); }
}
