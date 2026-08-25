import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min, Max, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuthorizationService } from '../common/authorization/authorization.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { AuditService } from '../audit/audit.service';

class ContactDto { @IsString() @MinLength(2) kind!: string; @IsString() @MinLength(1) value!: string; @IsString() @IsOptional() label?: string; @IsBoolean() @IsOptional() isPrimary?: boolean; }
class UnitDto { @IsString() @MinLength(2) name!: string; @IsString() @IsOptional() type?: string; @IsString() @IsOptional() parentUnitId?: string; }

@Controller('core-domain')
@UseGuards(AuthGuard, AuthorizationGuard)
export class CoreDomainController {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService, private readonly audit: AuditService) {}

  @Get('relationship-types') @RequirePermission('relationship.read')
  relationshipTypes() { return this.prisma.relationshipType.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }); }

  @Post('relationship-types') @RequirePermission('relationship.write')
  async createRelationshipType(@Body() d: { key: string; name: string; description?: string }, @Req() req: any) {
    const created = await this.prisma.relationshipType.create({ data: d });
    await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'RelationshipType', entityId: created.id, after: created });
    return created;
  }

  @Get('organizations/:organizationId/units') @RequirePermission('org.read')
  async units(@Param('organizationId') organizationId: string, @Req() req: any) { await this.authorization.assertPermission(req.user.sub, 'org.read', { organizationId: organizationId }); return this.prisma.organizationUnit.findMany({ where: { organizationId, status: 'ACTIVE' }, orderBy: { name: 'asc' }, include: { children: true } }); }

  @Post('organizations/:organizationId/units') @RequirePermission('org.write')
  async createUnit(@Param('organizationId') organizationId: string, @Body() d: UnitDto, @Req() req: any) { await this.authorization.assertPermission(req.user.sub, 'org.write', { organizationId: organizationId }); const created = await this.prisma.organizationUnit.create({ data: { organizationId, name: d.name.trim(), type: d.type ?? 'DEPARTMENT', parentUnitId: d.parentUnitId } }); await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'OrganizationUnit', entityId: created.id, organizationId, after: created }); return created; }

  @Get('organizations/:organizationId/contacts') @RequirePermission('org.read')
  async organizationContacts(@Param('organizationId') organizationId: string, @Req() req: any) { await this.authorization.assertPermission(req.user.sub, 'org.read', { organizationId: organizationId }); return this.prisma.contactInformation.findMany({ where: { organizationId }, orderBy: [{ isPrimary: 'desc' }, { kind: 'asc' }] }); }

  @Post('organizations/:organizationId/contacts') @RequirePermission('org.write')
  async createOrganizationContact(@Param('organizationId') organizationId: string, @Body() d: ContactDto, @Req() req: any) { await this.authorization.assertPermission(req.user.sub, 'org.write', { organizationId: organizationId }); const created = await this.prisma.contactInformation.create({ data: { organizationId, ...d } }); await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'ContactInformation', entityId: created.id, organizationId, after: created }); return created; }

  @Get('people/:personId/contacts') @RequirePermission('person.read')
  async personContacts(@Param('personId') personId: string, @Req() req: any) { const p = await this.prisma.person.findUniqueOrThrow({ where: { id: personId }, select: { organizationId: true } }); await this.authorization.assertPermission(req.user.sub, 'person.read', { organizationId: p.organizationId }); return this.prisma.contactInformation.findMany({ where: { personId }, orderBy: [{ isPrimary: 'desc' }, { kind: 'asc' }] }); }

  @Post('people/:personId/contacts') @RequirePermission('person.write')
  async createPersonContact(@Param('personId') personId: string, @Body() d: ContactDto, @Req() req: any) { const p = await this.prisma.person.findUniqueOrThrow({ where: { id: personId }, select: { organizationId: true } }); await this.authorization.assertPermission(req.user.sub, 'person.write', { organizationId: p.organizationId }); const created = await this.prisma.contactInformation.create({ data: { personId, ...d } }); await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'ContactInformation', entityId: created.id, organizationId: p.organizationId, after: created }); return created; }

  @Get('referrals') @RequirePermission('relationship.read')
  async referrals(@Req() req: any) {
    return this.prisma.referral.findMany({
      where: { deletedAt: null, OR: [{ createdById: req.user.sub }, { recipientUserId: req.user.sub }] },
      include: { sourceOrganization: true, targetOrganization: true, sourcePerson: true, targetPerson: true, relationship: true },
      orderBy: { createdAt: 'desc' }, take: 200,
    });
  }

  @Post('referrals') @RequirePermission('relationship.write')
  async createReferral(@Body() d: any, @Req() req: any) {
    if (!d.title?.trim()) throw new BadRequestException('Referral title is required');
    if (!d.sourceOrganizationId && !d.sourcePersonId) throw new BadRequestException('Referral source is required');
    if (!d.targetOrganizationId && !d.targetPersonId && !d.recipientUserId) throw new BadRequestException('Referral target is required');
    if (d.sourceOrganizationId) await this.authorization.assertPermission(req.user.sub, 'relationship.write', { organizationId: d.sourceOrganizationId });
    if (d.targetOrganizationId) await this.authorization.assertPermission(req.user.sub, 'relationship.read', { organizationId: d.targetOrganizationId });
    const created = await this.prisma.referral.create({ data: { ...d, title: d.title.trim(), createdById: req.user.sub } });
    await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'Referral', entityId: created.id, organizationId: d.sourceOrganizationId, after: created });
    return created;
  }

  @Patch('referrals/:id') @RequirePermission('relationship.write')
  async updateReferral(@Param('id') id: string, @Body() d: any, @Req() req: any) {
    const current = await this.prisma.referral.findUnique({ where: { id } });
    if (!current || current.deletedAt) throw new BadRequestException('Referral not found');
    if (current.sourceOrganizationId) await this.authorization.assertPermission(req.user.sub, 'relationship.write', { organizationId: current.sourceOrganizationId });
    const updated = await this.prisma.referral.update({ where: { id }, data: { ...d, ...(d.status === 'COMPLETED' ? { completedAt: new Date() } : {}) } });
    await this.audit.logMutation({ userId: req.user.sub, action: 'UPDATE', entityType: 'Referral', entityId: id, organizationId: current.sourceOrganizationId ?? undefined, before: current, after: updated });
    return updated;
  }

  @Get('projects/:projectId/risks') @RequirePermission('project.read')
  async projectRisks(@Param('projectId') projectId: string, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project) throw new BadRequestException('Project not found');
    if (project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.read', { organizationId: project.organizationId });
    return this.prisma.projectRisk.findMany({ where: { projectId }, orderBy: { score: 'desc' }, include: { owner: true } });
  }

  @Post('projects/:projectId/risks') @RequirePermission('project.write')
  async createProjectRisk(@Param('projectId') projectId: string, @Body() d: any, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project) throw new BadRequestException('Project not found');
    if (project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.write', { organizationId: project.organizationId });
    const probability = Math.max(0, Math.min(100, Number(d.probability ?? 0)));
    const impact = Math.max(0, Math.min(100, Number(d.impact ?? 0)));
    const created = await this.prisma.projectRisk.create({ data: { ...d, projectId, organizationId: project.organizationId ?? undefined, probability, impact, score: Math.round(probability * impact / 100) } });
    await this.audit.logMutation({ userId: req.user.sub, action: 'CREATE', entityType: 'ProjectRisk', entityId: created.id, organizationId: project.organizationId ?? undefined, after: created });
    return created;
  }

  @Patch('project-risks/:id') @RequirePermission('project.write')
  async updateProjectRisk(@Param('id') id: string, @Body() d: any, @Req() req: any) {
    const current = await this.prisma.projectRisk.findUnique({ where: { id }, include: { project: { select: { organizationId: true } } } });
    if (!current) throw new BadRequestException('Project risk not found');
    if (current.project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.write', { organizationId: current.project.organizationId });
    const probability = d.probability === undefined ? current.probability : Math.max(0, Math.min(100, Number(d.probability)));
    const impact = d.impact === undefined ? current.impact : Math.max(0, Math.min(100, Number(d.impact)));
    const updated = await this.prisma.projectRisk.update({ where: { id }, data: { ...d, probability, impact, score: Math.round(probability * impact / 100) } });
    return updated;
  }

  @Get('projects/:projectId/milestones') @RequirePermission('project.read')
  async projectMilestones(@Param('projectId') projectId: string, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project) throw new BadRequestException('Project not found');
    if (project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.read', { organizationId: project.organizationId });
    return this.prisma.projectMilestone.findMany({ where: { projectId }, orderBy: { dueAt: 'asc' }, include: { owner: true } });
  }

  @Post('projects/:projectId/milestones') @RequirePermission('project.write')
  async createProjectMilestone(@Param('projectId') projectId: string, @Body() d: any, @Req() req: any) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
    if (!project) throw new BadRequestException('Project not found');
    if (project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.write', { organizationId: project.organizationId });
    const created = await this.prisma.projectMilestone.create({ data: { ...d, projectId, dueAt: d.dueAt ? new Date(d.dueAt) : undefined, ownerId: d.ownerId ?? req.user.sub } });
    return created;
  }

  @Patch('project-milestones/:id') @RequirePermission('project.write')
  async updateProjectMilestone(@Param('id') id: string, @Body() d: any, @Req() req: any) {
    const current = await this.prisma.projectMilestone.findUnique({ where: { id }, include: { project: { select: { organizationId: true } } } });
    if (!current) throw new BadRequestException('Project milestone not found');
    if (current.project.organizationId) await this.authorization.assertPermission(req.user.sub, 'project.write', { organizationId: current.project.organizationId });
    return this.prisma.projectMilestone.update({ where: { id }, data: { ...d, ...(d.dueAt !== undefined ? { dueAt: d.dueAt ? new Date(d.dueAt) : null } : {}), ...(d.status === 'COMPLETED' && !current.completedAt ? { completedAt: new Date() } : {}) } });
  }

  @Post('actions/:actionId/dependencies/:dependsOnActionId') @RequirePermission('action.write')
  async addActionDependency(@Param('actionId') actionId: string, @Param('dependsOnActionId') dependsOnActionId: string, @Req() req: any) {
    if (actionId === dependsOnActionId) throw new BadRequestException('An action cannot depend on itself');
    const actions = await this.prisma.action.findMany({ where: { id: { in: [actionId, dependsOnActionId] }, deletedAt: null }, select: { id: true, ownerId: true, project: { select: { organizationId: true } }, relationship: { select: { sourceOrganizationId: true, targetOrganizationId: true } } } });
    if (actions.length !== 2) throw new BadRequestException('Action not found');
    const orgs = actions.flatMap(a => [a.project?.organizationId, a.relationship?.sourceOrganizationId, a.relationship?.targetOrganizationId]).filter(Boolean) as string[];
    if (orgs.length) await this.authorization.assertAnyOrganizationAccess(req.user.sub, orgs);
    const path = await this.prisma.actionDependency.findUnique({ where: { actionId_dependsOnActionId: { actionId, dependsOnActionId } } });
    if (path) return path;
    // Prevent a simple dependency cycle by walking existing dependencies.
    let frontier = [dependsOnActionId]; const seen = new Set(frontier);
    while (frontier.length) {
      const rows = await this.prisma.actionDependency.findMany({ where: { actionId: { in: frontier } }, select: { dependsOnActionId: true } });
      const next = rows.map(r => r.dependsOnActionId).filter(x => !seen.has(x));
      next.forEach(x => seen.add(x)); frontier = next;
      if (seen.has(actionId)) throw new BadRequestException('Action dependency would create a cycle');
    }
    return this.prisma.actionDependency.create({ data: { actionId, dependsOnActionId } });
  }

  @Delete('actions/:actionId/dependencies/:dependsOnActionId') @RequirePermission('action.write')
  async removeActionDependency(@Param('actionId') actionId: string, @Param('dependsOnActionId') dependsOnActionId: string, @Req() req: any) {
    const row = await this.prisma.actionDependency.findUnique({ where: { actionId_dependsOnActionId: { actionId, dependsOnActionId } } });
    if (!row) throw new BadRequestException('Dependency not found');
    return this.prisma.actionDependency.delete({ where: { id: row.id } });
  }

  @Get('connection-paths') @RequirePermission('network.read')
  async connectionPaths(@Req() req: any) {
    const ids = await this.authorization.accessibleOrganizationIds(req.user.sub);
    return this.prisma.connectionPath.findMany({
      where: { sourceOrganizationId: { in: ids }, targetOrganizationId: { in: ids } },
      orderBy: [{ strength: 'desc' }, { createdAt: 'desc' }], take: 200,
    });
  }

  @Post('connection-paths') @RequirePermission('network.read')
  async createConnectionPath(@Body() d: any, @Req() req: any) {
    if (!d.sourceOrganizationId || !d.targetOrganizationId) throw new BadRequestException('Both path endpoints are required');
    await this.authorization.assertAnyOrganizationAccess(req.user.sub, [d.sourceOrganizationId, d.targetOrganizationId]);
    const hops = Math.max(0, Number(d.hops ?? 0));
    const type = hops === 0 ? 'DIRECT' : hops === 1 ? 'ONE_HOP' : hops === 2 ? 'TWO_HOP' : 'MULTI_HOP';
    const created = await this.prisma.connectionPath.create({ data: { sourceOrganizationId: d.sourceOrganizationId, targetOrganizationId: d.targetOrganizationId, hops, type: type as any, strength: Math.max(0, Math.min(100, Number(d.strength ?? 0))), successProbability: Math.max(0, Math.min(100, Number(d.successProbability ?? 0))), bestConnectorOrganizationId: d.bestConnectorOrganizationId, bestConnectorPersonId: d.bestConnectorPersonId, nodes: d.nodes ?? [], edges: d.edges ?? [], createdById: req.user.sub } });
    return created;
  }

}
