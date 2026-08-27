'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Project" eyebrow="PROJECT" endpoint="/projects" id={p.id} timelineEndpoint={undefined} actions={[{label:'حذف',method:'DELETE',path:'/projects/:id',confirm:'این پروژه حذف شود؟'}]}/>}
