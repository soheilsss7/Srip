'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={"title": "مجوزها", "eyebrow": "ADMIN / PERMISSIONS", "description": "مدیریت مجوزها با API واقعی و کنترل دسترسی Backend.", "endpoint": "/authorization/permissions", "fields": [{"name": "key", "label": "Key", "required": true}, {"name": "description", "label": "توضیح"}], "idField": "id", "create": true, "update": true, "remove": false} />}
