'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "نقش‌ها", "eyebrow": "ADMIN / ROLES", "description": "مدیریت نقش‌ها با API واقعی و کنترل دسترسی Backend.", "endpoint": "/authorization/roles", "fields": [{"name": "key", "label": "کلید (Key)", "required": true}, {"name": "name", "label": "نام", "required": true}, {"name": "description", "label": "توضیح", "type": "textarea"}], "idField": "id", "create": true, "update": false, "remove": false}} />}
