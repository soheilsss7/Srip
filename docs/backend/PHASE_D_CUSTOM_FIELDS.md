# Phase D — Custom Fields

This phase completes the backend Custom Fields contract without removing or rewriting prior phases.

## Definition
- Admin can create/update/deactivate/delete a Custom Field through the existing Admin API and the canonical `/custom-fields` API.
- Supported field types: `text`, `number`, `boolean`, `date`, `datetime`, `select`, `multiselect`, `email`, `url`.
- `select` and `multiselect` require a non-empty unique string options array.
- A field type cannot be changed after values exist.
- A field with values cannot be deleted; it must be deactivated instead.
- Field keys are normalized and unique per organization/entity type; global fields are additionally unique with a PostgreSQL partial unique index.

## Values
`CustomFieldValue` stores exactly one typed value:
- text/email/url -> `stringValue`
- number -> `numberValue`
- boolean -> `booleanValue`
- date/datetime -> `dateValue`
- select/multiselect -> `jsonValue`

The database CHECK constraint rejects rows that contain zero or multiple typed value columns.

## Required fields
The bulk value endpoint validates all active required fields for the entity after the transaction writes. A required value cannot be removed.

## Security
- Definition management requires `admin.custom_fields` and organization scope.
- Entity value reads/writes require `entity.read`/`entity.write` and verify the actual entity organization scope.
- A field is only writable when its entity type and organization scope match the target entity.

## Audit
The following audit actions are recorded:
- `CUSTOM_FIELD_CREATED`
- `CUSTOM_FIELD_UPDATED`
- `CUSTOM_FIELD_DELETED`
- `CUSTOM_FIELD_VALUE_SET`
- `CUSTOM_FIELD_VALUE_REMOVED`

## API
- `GET /custom-fields`
- `POST /custom-fields`
- `DELETE /custom-fields/:id`
- `GET /entities/:entityType/:entityId/custom-fields`
- `POST /entities/:entityType/:entityId/custom-fields`
- `DELETE /entities/:entityType/:entityId/custom-fields/:customFieldId`

Existing `/admin/custom-fields` routes remain available and now delegate to the same canonical service, so there is no duplicate business implementation.
