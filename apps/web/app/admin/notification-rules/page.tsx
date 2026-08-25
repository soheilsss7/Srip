'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={{"title": "قواعد اعلان", "eyebrow": "ADMIN / NOTIFICATION RULES", "description": "مدیریت قواعد اعلان با API واقعی و کنترل دسترسی Backend.", "endpoint": "/notifications/rules", "fields": [{"name": "name", "label": "نام", "required": true}, {"name": "event", "label": "Event", "required": true}], "idField": "id", "create": true, "update": true, "remove": false}} />}
