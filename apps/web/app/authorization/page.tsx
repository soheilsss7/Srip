'use client';
import {useEffect,useState} from 'react';
import {api} from '../_lib/api';
import {ErrorCard,Loading,PageHeader} from '../_components/page-ui';
export default function Page(){const[d,setD]=useState<any>(null),[e,setE]=useState('');useEffect(()=>{api('/authorization/permissions').then(setD).catch(x=>setE(x.message))},[]);return <main className="feature-page"><PageHeader eyebrow="AUTHORIZATION" title="Authorization" description="RBAC، Scope و Permission-aware access در سطح Backend."/><ErrorCard message={e}/>{!d&&!e?<Loading/>:<section className="panel"><pre className="json-view">{JSON.stringify(d,null,2)}</pre></section>}</main>}
