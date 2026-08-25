import { Controller, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ReportingService } from './reporting.service';

@Controller('reports')
@UseGuards(AuthGuard, AuthorizationGuard)
export class ReportingController {
  constructor(private readonly reporting: ReportingService) {}
  @Get(':kind') @RequirePermission('report.read') report(@Req() req:any,@Param('kind') kind:string,@Query('organizationId') organizationId?:string,@Query('page') page?:string,@Query('limit') limit?:string){return this.reporting.report(req.user.sub,kind,organizationId,Number(page)||1,Number(limit)||200);}
  @Get(':kind/export/:format') @RequirePermission('report.export') async export(@Req() req:any,@Param('kind') kind:string,@Param('format') format:string,@Query('organizationId') organizationId?:string,@Query('approvalId') approvalId?:string,@Res() res?:Response){const result=await this.reporting.export(req.user.sub,kind,format,organizationId,req.requestId,req.ip,approvalId);res!.setHeader('Content-Type',result.contentType);res!.setHeader('Content-Disposition',`attachment; filename="${result.filename}"`);res!.setHeader('Content-Length',result.body.length);return result.body;}
}
