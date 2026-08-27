'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Person" eyebrow="PEOPLE" endpoint="/people" id={p.id} timelineEndpoint={'/people/:id/timeline'} actions={[{label:'بایگانی',method:'PATCH',path:'/people/:id/archive',confirm:'این شخص بایگانی شود؟'}]}/>}
