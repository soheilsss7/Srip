import { Body, Controller, Get, Param, Post, Query, Req, UseGuards, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
@Controller('documents')
@UseGuards(AuthGuard,AuthorizationGuard)
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}
  @Get() @RequirePermission('document.read') list(@Req() req:any,@Query('organizationId') organizationId?:string){ return this.service.list(req.user.sub, organizationId); }
  @Get('status') @RequirePermission('document.read') status(){ return this.service.status(); }
  @Get(':id') @RequirePermission('document.read') get(@Req() req:any,@Param('id') id:string){ return this.service.get(req.user.sub,id); }
  @Get(':id/signed-url') @RequirePermission('document.read')
  signed(@Req() req:any,@Param('id') id:string){ return this.service.signedReadUrl(req.user.sub,id); }
  @Post('upload') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:Number(process.env.FILE_MAX_BYTES||26214400),files:1}})) @RequirePermission('document.write')
  upload(@Req() req:any,@UploadedFile() file:any,@Body() body:any){ return this.service.upload(req.user.sub,file,body.organizationId,body.classification||'INTERNAL'); }
  @Post(':id/index') @RequirePermission('document.write') index(@Req() req:any,@Param('id') id:string,@Body() body:{text:string}){ return this.service.index(req.user.sub,id,body.text); }
}
