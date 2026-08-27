'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "برچسب‌ها", "eyebrow": "ADMIN / TAGS", "description": "مدیریت برچسب‌ها با API واقعی و کنترل دسترسی Backend.", "endpoint": "/admin/tags", "fields": [{"name": "name", "label": "نام", "required": true}], "idField": "id", "create": true, "update": false, "remove": true}} />}
