'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "برچسب‌ها", "eyebrow": "ADMIN / TAGS", "description": "مدیریت برچسب‌ها با API واقعی و کنترل دسترسی Backend.", "endpoint": "/tags", "fields": [{"name": "name", "label": "نام", "required": true}, {"name": "color", "label": "رنگ"}], "idField": "id", "create": true, "update": true, "remove": true}} />}
