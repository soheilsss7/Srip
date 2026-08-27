'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Organization" eyebrow="ORGANIZATION" endpoint="/organizations" id={p.id} timelineEndpoint={'/organizations/:id/timeline'} actions={[{label:'بایگانی',method:'PATCH',path:'/organizations/:id/archive',confirm:'این سازمان بایگانی شود؟'}]}/>}
