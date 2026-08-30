import { BadRequestException, Controller, Get, Param, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { DataImportService } from './data-import.service';
import { DataQualityService } from './data-quality.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { AuthorizationService } from '../common/authorization/authorization.service';

@Controller('data')
@UseGuards(AuthGuard, AuthorizationGuard)
export class DataManagementController {
  constructor(private readonly imports: DataImportService, private readonly qualityService: DataQualityService, private readonly duplicateDetection: DuplicateDetectionService, private readonly auth: AuthorizationService) {}

  @Post('import/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: Number(process.env.IMPORT_MAX_BYTES || 26214400), files: 1 } }))
  @RequirePermission('data.import')
  preview(@Req() req: any, @UploadedFile() file: any, @Body() body: any) { return this.imports.preview(req.user.sub, file, body); }

  @Get('import/:id/report')
  @RequirePermission('data.import')
  report(@Req() req: any, @Param('id') id: string, @Query('page') page?: string, @Query('limit') limit?: string) { return this.imports.getReport(req.user.sub, id, Number(page)||1, Number(limit)||100); }

  @Post('import/:id/approve')
  @RequirePermission('data.import.approve')
  approve(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.imports.approve(req.user.sub, id, body); }

  @Get('quality')
  @RequirePermission('data.quality.read')
  quality(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.qualityService.get(req.user.sub, organizationId); }

  @Post('quality/scan')
  @RequirePermission('data.quality.execute')
  scan(@Req() req: any, @Body() body: any) { return this.qualityService.execute(req.user.sub, body?.organizationId); }

  @Get('duplicates')
  @RequirePermission('data.quality.read')
  duplicates(@Req() req: any, @Query('organizationId') organizationId?: string) { return this.qualityService.duplicates(req.user.sub, organizationId); }

  @Post('duplicates/merge-preview')
  @RequirePermission('data.quality.execute')
  async mergePreview(@Req() req: any, @Body() body: any) {
    return this.duplicateDetection.mergePreview(req.user.sub, String(body?.entityType || ''), String(body?.primaryId || ''), String(body?.duplicateId || ''), body?.organizationId ? String(body.organizationId) : undefined);
  }

  @Post('duplicates/merge')
  @RequirePermission('data.quality.execute')
  async merge(@Req() req: any, @Body() body: any) {
    return this.duplicateDetection.merge(req.user.sub, String(body?.entityType || ''), String(body?.primaryId || ''), String(body?.duplicateId || ''), body?.organizationId ? String(body.organizationId) : undefined, String(body?.confirmation || ''));
  }

  @Post('duplicates/detect')
  @RequirePermission('data.import')
  async detectDuplicates(@Req() req: any, @Body() body: any) {
    const entityType = String(body?.entityType || '').toUpperCase();
    if (entityType !== 'ORGANIZATION' && entityType !== 'PERSON') throw new BadRequestException('entityType must be ORGANIZATION or PERSON');
    const organizationId = body?.organizationId ? String(body.organizationId) : undefined;
    if (!organizationId) throw new BadRequestException('organizationId is required for duplicate detection');
    await this.auth.assertAnyOrganizationAccess(req.user.sub, [organizationId]);
    const scope = await this.auth.accessibleOrganizationIds(req.user.sub);
    return this.duplicateDetection.detect(entityType as any, body?.data || {}, organizationId, scope);
  }
}
