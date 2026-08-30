'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "مجوزها", "eyebrow": "ADMIN / PERMISSIONS", "description": "فهرست مجوزهای Backend با کنترل دسترسی.", "endpoint": "/admin/permissions", "permission": "enterprise.admin", "columns": ["key", "description"], "labels": {"key": "Key", "description": "توضیح"}, "idField": "id", "create": false, "update": false, "remove": false}} />}
