'use client';
import {ResourceConsole} from '../../_components/resource-console';
export default function Page(){return <ResourceConsole config={"title": "قواعد امتیازدهی", "eyebrow": "ADMIN / SCORING", "description": "مدیریت قواعد امتیازدهی با API واقعی و کنترل دسترسی Backend.", "endpoint": "/scores/scoring-rules", "fields": [{"name": "name", "label": "نام", "required": true}, {"name": "description", "label": "توضیح", "type": "textarea"}], "idField": "id", "create": true, "update": true, "remove": false} />}
