import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from '../common/guards/auth.guard';
import { AuthorizationGuard } from '../common/guards/authorization.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { NotesService } from './notes.service';

class NoteDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsString() @MinLength(1) @MaxLength(100_000) body!: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() personId?: string;
}

class UpdateNoteDto {
  @IsOptional() @IsString() @MaxLength(200) title?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100_000) body?: string;
  @IsOptional() @IsUUID() organizationId?: string;
  @IsOptional() @IsUUID() personId?: string;
}

@Controller('notes')
@UseGuards(AuthGuard, AuthorizationGuard)
export class NotesController {
  constructor(private readonly service: NotesService) {}

  @Get()
  @RequirePermission('entity.read')
  list(
    @Req() req: any,
    @Query('organizationId') organizationId?: string,
    @Query('personId') personId?: string,
    @Query('q') query?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list(req.user.sub, { organizationId, personId, query, page, pageSize });
  }

  @Get(':id')
  @RequirePermission('entity.read')
  get(@Req() req: any, @Param('id') id: string) {
    return this.service.get(req.user.sub, id);
  }

  @Post()
  @RequirePermission('entity.write')
  create(@Req() req: any, @Body() dto: NoteDto) {
    return this.service.create(req.user.sub, dto);
  }

  @Patch(':id')
  @RequirePermission('entity.write')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateNoteDto) {
    return this.service.update(req.user.sub, id, dto);
  }

  @Delete(':id')
  @RequirePermission('entity.write')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.sub, id);
  }
}
