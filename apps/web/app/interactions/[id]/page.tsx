'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Interaction" eyebrow="INTERACTION" endpoint="/interactions" id={p.id} timelineEndpoint={'/interactions/:id'} actions={[{label:'حذف',method:'DELETE',path:'/interactions/:id',confirm:'این مورد حذف شود؟'}]}/>}
