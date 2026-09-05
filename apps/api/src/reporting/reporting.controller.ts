import { Controller, Get, Param, Query, Req, StreamableFile, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ReportingService } from './reporting.service';

@Controller('reports')
@UseGuards(AuthGuard, AuthorizationGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}
  @Get(':kind') @RequirePermission('report.read') report(@Req() req:any,@Param('kind') kind:string,@Query('organizationId') organizationId?:string,@Query('page') page?:string,@Query('limit') limit?:string){return this.reporting.report(req.user.sub,kind,organizationId,Number(page)||1,Number(limit)||200);}
  @Get(':kind/export/:format') @RequirePermission('report.export') async export(@Req() req:any,@Param('kind') kind:string,@Param('format') format:string,@Query('organizationId') organizationId?:string,@Query('approvalId') approvalId?:string){const result=await this.reporting.export(req.user.sub,kind,format,organizationId,req.requestId,req.ip,approvalId);return new StreamableFile(result.body,{type:result.contentType,disposition:`attachment; filename="${result.filename}"`,length:result.body.length});}
}
