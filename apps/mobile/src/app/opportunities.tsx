import React from 'react';
import { DataScreen } from '../features/data-screen';
export default function Opportunities(){return <DataScreen title="Opportunities" path="/opportunities" fields={['id','name','status','probability','value']}/>}
