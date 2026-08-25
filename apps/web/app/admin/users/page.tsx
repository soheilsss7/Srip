'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "کاربران", "eyebrow": "ADMIN / USERS", "description": "مدیریت کاربران با API واقعی و کنترل دسترسی Backend.", "endpoint": "/users", "fields": [{"name": "email", "label": "ایمیل", "type": "email", "required": true}, {"name": "firstName", "label": "نام"}, {"name": "lastName", "label": "نام خانوادگی"}], "idField": "id", "create": true, "update": true, "remove": true}} />}
