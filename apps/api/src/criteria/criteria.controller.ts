import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CriteriaService } from './criteria.service';

/**
 * معیارهای ارزیابی و پرسش‌نامۀ ورود اطلاعات.
 *
 * مسیرها زیر پیشوند `/api/v1` منتشر می‌شوند. امتیاز همیشه «امتیاز معیارمحور» است:
 * یعنی عددی که فقط از معیارهای پاسخ‌داده‌شده ساخته می‌شود و پوشش اطلاعات،
 * اطمینان، باند عدم‌قطعیت و معیارهای ناشناخته را همراه خود می‌آورد.
 */
@Controller('criteria')
@UseGuards(AuthGuard, AuthorizationGuard)
export class CriteriaController {
  constructor(private readonly criteria: CriteriaService) {}

  @Get()
  @RequirePermission('entity.read')
  catalog(@Query('subjectType') subjectType?: string) {
    return this.criteria.catalog(subjectType);
  }

  @Get('questionnaire/:subjectType')
  @RequirePermission('entity.read')
  questionnaire(@Param('subjectType') subjectType: string) {
    return this.criteria.questionnaire(subjectType);
  }

  @Get('assessment/:subjectType/:subjectId')
  @RequirePermission('entity.read')
  assessment(@Req() req: any, @Param('subjectType') subjectType: string, @Param('subjectId') subjectId: string) {
    return this.criteria.assess(subjectType, subjectId, req.user?.sub);
  }

  /** ثبت پاسخ‌های ارزیابی (پرسش‌نامای ساخت رکورد یا بازبینی دوره‌ای). */
  @Post('assessment/:subjectType/:subjectId')
  @RequirePermission('entity.write')
  save(@Req() req: any, @Param('subjectType') subjectType: string, @Param('subjectId') subjectId: string, @Body() body: any) {
    return this.criteria.saveAnswers(req.user?.sub, {
      subjectType: subjectType as any,
      subjectId,
      answers: body?.answers ?? [],
      source: body?.source ?? 'MANUAL',
      replace: body?.replace === true,
      syncScores: body?.syncScores !== false,
    });
  }

  @Patch('assessment/:subjectType/:subjectId')
  @RequirePermission('entity.write')
  patch(@Req() req: any, @Param('subjectType') subjectType: string, @Param('subjectId') subjectId: string, @Body() body: any) {
    return this.save(req, subjectType, subjectId, body);
  }

  @Get('review-queue')
  @RequirePermission('entity.read')
  reviewQueue(@Req() req: any, @Query('organizationId') organizationId?: string) {
    return this.criteria.reviewQueue(req.user?.sub, organizationId);
  }

  @Get('coverage/:organizationId')
  @RequirePermission('analytics.read')
  coverage(@Req() req: any, @Param('organizationId') organizationId: string, @Query('subjectType') subjectType = 'RELATIONSHIP') {
    return this.criteria.coverageReport(req.user?.sub, organizationId, subjectType);
  }

  /** تنظیم محلی وزن خانواده‌ها (مدیریتی، داده‌محور — بدون تغییر کد). */
  @Get('overrides/:organizationId')
  @RequirePermission('admin.catalog')
  async overrides(@Req() req: any, @Param('organizationId') organizationId: string) {
    return this.criteria.listOverrides(req.user?.sub, organizationId);
  }

  @Patch('overrides/:organizationId')
  @RequirePermission('admin.catalog')
  async saveOverride(@Req() req: any, @Param('organizationId') organizationId: string, @Body() body: any) {
    return this.criteria.saveOverride(req.user?.sub, organizationId, body ?? {});
  }
}
