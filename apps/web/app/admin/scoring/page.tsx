'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "قواعد امتیازدهی", "eyebrow": "ADMIN / SCORING", "description": "فهرست قواعد امتیازدهی با API واقعی و کنترل دسترسی Backend.", "endpoint": "/admin/scoring-rules", "columns": ["name", "description", "active", "organizationId"], "labels": {"name": "نام", "description": "توضیح", "active": "فعال", "organizationId": "سازمان"}, "idField": "id", "create": false, "update": false, "remove": false}} />}
