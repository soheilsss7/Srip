'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Opportunity" eyebrow="OPPORTUNITY" endpoint="/opportunities" id={p.id} timelineEndpoint={undefined} actions={[{label:'حذف',method:'DELETE',path:'/opportunities/:id',confirm:'این مورد حذف شود؟'}]}/>}
