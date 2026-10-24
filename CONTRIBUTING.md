# Development Guide

## Repository layout

- `apps/web`: Web application
- `apps/mobile`: Mobile application
- `apps/api`: Backend API
- `packages`: Shared packages
- `docs`: Project and verification documentation
- `scripts`: Automation and verification

## Change discipline

1. Keep changes scoped to the current implementation phase.
2. Reuse existing architecture before introducing new dependencies.
3. Update the implementation checklist when a requirement is actually implemented and verified.
4. Do not mark a requirement complete based on file/directory presence alone.
5. Run the relevant repository verification before handing off a phase.

## Phase handoff

Each phase must leave the repository in a state that can be used as the input for the next phase.
