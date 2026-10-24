import { EntityResponseDto } from './entity-response.dto';

describe('Phase G DTO boundary', () => {
  it('strips persistence/security-only fields recursively', () => {
    const dto = EntityResponseDto.fromUnknown({
      id: '1',
      name: 'example',
      passwordHash: 'secret',
      storageKey: 'private/path',
      deletedById: 'user-2',
      nested: { refreshToken: 'secret-token', safe: true },
    });
    expect(dto).toEqual({ id: '1', name: 'example', nested: { safe: true } });
  });

  it('does not mutate the source object', () => {
    const source = { id: '1', nested: { value: 1 } };
    const dto = EntityResponseDto.fromUnknown(source);
    expect(dto).not.toBe(source);
    expect(dto.nested).not.toBe(source.nested);
  });
});
