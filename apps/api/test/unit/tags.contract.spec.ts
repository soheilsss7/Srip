import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Phase C Tag System contract', () => {
  const root = join(__dirname, '../../src/tags');

  it('exposes the complete Tag API surface', () => {
    const source = readFileSync(join(root, 'tags.controller.ts'), 'utf8');
    for (const route of [
      "@Post('tags')","@Get('tags')","@Patch('tags/:id')","@Delete('tags/:id')",
      "@Get('entities/:entityType/:entityId/tags')","@Post('entities/:entityType/:entityId/tags')",
      "@Delete('entities/:entityType/:entityId/tags/:tagId')",
    ]) expect(source).toContain(route);
  });

  it('enforces tag and entity permissions', () => {
    const controller = readFileSync(join(root, 'tags.controller.ts'), 'utf8');
    const service = readFileSync(join(root, 'tags.service.ts'), 'utf8');
    expect(controller).toContain("@RequirePermission('tag.read')");
    expect(controller).toContain("@RequirePermission('tag.write')");
    expect(service).toContain("'entity.read'");
    expect(service).toContain("'entity.write'");
  });
});
