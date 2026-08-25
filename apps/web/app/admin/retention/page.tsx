import { OpsWorkspace } from '../../_components/ops-workspace';
export default function Page(){return <OpsWorkspace title="Retention & Lifecycle" eyebrow="ADMIN / RETENTION" description="Retention preview و lifecycle با کنترل Permission و Audit." endpoint="/privacy/retention/preview" actions={[{label:'Retention Execute',path:'/privacy/retention/execute'}]}/> }
