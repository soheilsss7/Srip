import React from 'react';
import { DataScreen } from '../features/data-screen';
export default function Commitments(){return <DataScreen title="Commitments" path="/commitments" fields={['id','description','status','dueAt','risk']}/>}
