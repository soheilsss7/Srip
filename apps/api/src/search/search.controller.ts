import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthorizationGuard } from '../common/guards/authorization.guard'; import { RequirePermission } from '../common/decorators/require-permission.decorator'; import { AuthGuard } from '../common/guards/auth.guard'; import { SearchService } from './search.service';
@Controller('search') @UseGuards(AuthGuard, AuthorizationGuard)
export class SearchController { constructor(private readonly s:SearchService){}
 @Get() @RequirePermission('search.read') all(@Req() req:any,@Query('q') q:string,@Query('limit') limit?:string,@Query() filters?:any){return this.s.all(req.user.sub,q||'',Math.min(Number(limit||20),100),filters||{})}
 @Get('saved') @RequirePermission('search.read') saved(@Req() req:any){return this.s.saved(req.user.sub)}
 @Post('saved') @RequirePermission('search.write') create(@Req() req:any,@Body() b:any){return this.s.createSaved(req.user.sub,b)}
 @Patch('saved/:id') @RequirePermission('search.write') update(@Req() req:any,@Param('id')id:string,@Body()b:any){return this.s.updateSaved(req.user.sub,id,b)}
 @Delete('saved/:id') @RequirePermission('search.write') del(@Req() req:any,@Param('id')id:string){return this.s.deleteSaved(req.user.sub,id)}
 @Post('saved/:id/run') @RequirePermission('search.read') run(@Req() req:any,@Param('id')id:string,@Query('limit')limit?:string){return this.s.runSaved(req.user.sub,id,Math.min(Number(limit||20),100))}
}
