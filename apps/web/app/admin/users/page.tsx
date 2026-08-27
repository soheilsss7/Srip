'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "کاربران", "eyebrow": "ADMIN / USERS", "description": "فهرست کاربران با API واقعی و کنترل دسترسی Backend.", "endpoint": "/admin/users", "columns": ["email", "firstName", "lastName", "organizationId", "active", "role"], "labels": {"email": "ایمیل", "firstName": "نام", "lastName": "نام خانوادگی", "organizationId": "سازمان", "active": "فعال", "role": "نقش"}, "idField": "id", "create": false, "update": false, "remove": false}} />}
