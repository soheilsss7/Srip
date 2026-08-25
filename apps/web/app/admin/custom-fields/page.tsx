'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={"title": "فیلدهای سفارشی", "eyebrow": "ADMIN / CUSTOM FIELDS", "description": "مدیریت فیلدهای سفارشی با API واقعی و کنترل دسترسی Backend.", "endpoint": "/custom-fields", "fields": [{"name": "key", "label": "Key", "required": true}, {"name": "label", "label": "Label", "required": true}, {"name": "entityType", "label": "Entity Type", "required": true}], "idField": "id", "create": true, "update": true, "remove": true} />}
