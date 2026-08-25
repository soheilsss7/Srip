'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Action" eyebrow="ACTION" endpoint="/actions" id={p.id} timelineEndpoint={'/actions/:id'} actions={[{label:'حذف',method:'DELETE',path:'/actions/:id',confirm:'این مورد حذف شود؟'}]}/>}
