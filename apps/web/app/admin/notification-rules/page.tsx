'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "قواعد اعلان", "eyebrow": "ADMIN / NOTIFICATION RULES", "description": "فهرست قواعد اعلان با API واقعی و کنترل دسترسی Backend.", "endpoint": "/admin/notification-rules", "columns": ["name", "event", "channel", "active", "organizationId"], "labels": {"name": "نام", "event": "Event", "channel": "کانال", "active": "فعال", "organizationId": "سازمان"}, "idField": "id", "create": false, "update": false, "remove": false}} />}
