'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Meeting" eyebrow="MEETING" endpoint="/meetings" id={p.id} timelineEndpoint={'/meetings/:id'} actions={[{label:'حذف',method:'DELETE',path:'/meetings/:id',confirm:'این مورد حذف شود؟'}]}/>}
