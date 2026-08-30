import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Notes first-class product contract', () => {
  const source = (file: string) => readFileSync(join(__dirname, '../../src', file), 'utf8');

  it('exposes a protected CRUD resource instead of a documents redirect', () => {
    const controller = source('notes/notes.controller.ts');
    expect(controller).toContain("@Controller('notes')");
    expect(controller).toContain("@RequirePermission('entity.read')");
    expect(controller).toContain("@RequirePermission('entity.write')");
    expect(controller).toContain('@Post()');
    expect(controller).toContain('@Patch(\':id\')');
    expect(controller).toContain('@Delete(\':id\')');
  });

  it('keeps notes in the lifecycle and application module contracts', () => {
    expect(source('common/data-lifecycle/data-lifecycle.types.ts')).toContain("Note:{delegate:'note'");
    expect(source('notes/notes.module.ts')).toContain('DataLifecycleModule');
    expect(source('app.module.ts')).toContain('NotesModule');
  });
});
