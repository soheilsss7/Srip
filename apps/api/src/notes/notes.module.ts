import { Module } from '@nestjs/common';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { DataLifecycleModule } from '../common/data-lifecycle/data-lifecycle.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [DataLifecycleModule, AuditModule],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NotesModule {}
