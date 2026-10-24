import { Controller, Get, Post, Patch, Delete, Query, Body, Param, UseGuards, Req, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuthGuard } from '../common/guards/auth.guard';
import { NetworkService } from './network.service';

@Controller('network')
@UseGuards(AuthGuard, AuthorizationGuard)
export class NetworkController {
  constructor(private readonly network: NetworkService) {}
  @Get('graph') @RequirePermission('network.read') graph(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('type') type?:string, @Query('status') status?:string, @Query('q') q?:string, @Query('focus') focus?:string, @Query('limit', new DefaultValuePipe(250), ParseIntPipe) limit=250, @Query('cursor') cursor?:string) { return this.network.graph(req.user.sub, organizationId, type, status, q, focus, limit, cursor); }
  @Get('path') @RequirePermission('network.read') path(@Req() req:any, @Query('from') from:string, @Query('to') to:string, @Query('organizationId') organizationId?:string, @Query('mode') mode:'shortest'|'best'='shortest') { return this.network.path(req.user.sub, from, to, organizationId, mode === 'best' ? 'best' : 'shortest'); }
  @Get('centrality') @RequirePermission('network.read') centrality(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit=20) { return this.network.centrality(req.user.sub, organizationId, limit); }
  @Get('bridges') @RequirePermission('network.read') bridgePeople(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit=20) { return this.network.bridgePeople(req.user.sub, organizationId, limit); }
  @Get('bottlenecks') @RequirePermission('network.read') bottlenecks(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit=20) { return this.network.bottlenecks(req.user.sub, organizationId, limit); }
  @Get('single-points-of-failure') @RequirePermission('network.read') singlePoints(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit=20) { return this.network.singlePointsOfFailure(req.user.sub, organizationId, limit); }
  @Get('connectors') @RequirePermission('network.read') connectors(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit=10) { return this.network.connectors(req.user.sub, organizationId, limit); }

  @Get('person-relationships') @RequirePermission('network.read') listPersonRelationships(@Req() req:any, @Query('organizationId') organizationId?:string, @Query('status') status?:string, @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit=100, @Query('cursor') cursor?:string) { return this.network.listPersonRelationships(req.user.sub, organizationId, status, limit, cursor); }
  @Post('person-relationships') @RequirePermission('relationship.write') createPersonRelationship(@Req() req:any, @Body() body:any) { return this.network.createPersonRelationship(req.user.sub, body); }
  @Patch('person-relationships/:id') @RequirePermission('relationship.write') updatePersonRelationship(@Req() req:any, @Param('id') id:string, @Body() body:any) { return this.network.updatePersonRelationship(req.user.sub, id, body); }
  @Delete('person-relationships/:id') @RequirePermission('relationship.write') archivePersonRelationship(@Req() req:any, @Param('id') id:string) { return this.network.archivePersonRelationship(req.user.sub, id); }
}
