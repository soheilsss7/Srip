import React from 'react';
import { DataScreen } from '../features/data-screen';
export default function Projects(){return <DataScreen title="Projects" path="/projects" fields={['id','name','status','priority','targetAt']}/>}
