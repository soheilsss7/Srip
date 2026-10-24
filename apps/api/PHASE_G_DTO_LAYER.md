# PHASE G — DTO Layer

## Contract

All controller-facing backend service responses must cross an explicit DTO boundary. Prisma persistence objects are not returned directly.

Canonical flow:

`Prisma Entity -> Resource Authorization -> Field Authorization -> DTO -> Controller`

## Implemented

- `common/dto/entity-response.dto.ts` — defensive response DTO boundary for backend entities.
- `common/dto/relationship-response.dto.ts` — explicit Relationship response contract.
- `common/authorization/relationship-presenter.ts` — Relationship authorization-aware presenter returning the DTO contract.
- Sensitive persistence/security fields are stripped recursively (`passwordHash`, token hashes/encrypted tokens, MFA secrets, storage keys, deletion actor fields, etc.).
- Relationship sensitive fields remain controlled by `FieldSecurityService`.
- Domain services that expose Prisma-backed data now return DTOs rather than raw Prisma objects.
- Internal raw persistence loaders remain private where a subsequent business operation requires persistence-only data; e.g. Document signed-download uses an authorized private loader so `storageKey` never enters the public DTO.
- AI code is intentionally excluded from this phase, per project scope.

## Verification

`test/phase-g/verify-phase-g.mjs` verifies:

1. no direct `return this.prisma.*` remains in non-AI controller-facing services;
2. Prisma-backed services have the DTO boundary;
3. RelationshipPresenter uses FieldSecurityService and RelationshipResponseDto;
4. sensitive persistence fields are present in the DTO deny-list;
5. all backend TypeScript source parses successfully.
