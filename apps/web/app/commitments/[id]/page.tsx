'use client';
import {use} from 'react';import {EntityDetail} from '../../_components/entity-detail';
export default function Page({params}:{params:Promise<{id:string}>}){const p=use(params);return <EntityDetail title="Commitment" eyebrow="COMMITMENT" endpoint="/commitments" id={p.id} timelineEndpoint={'/commitments/:id'} actions={[{label:'حذف',method:'DELETE',path:'/commitments/:id',confirm:'این مورد حذف شود؟'}]}/>}
