import { OpsWorkspace } from '../_components/ops-workspace';
export default function Page(){return <OpsWorkspace title="مرکز امنیت و Governance" eyebrow="SECURITY" description="Security events، Governance preflight و export audit را بدون افشای Secret مشاهده کنید." endpoint="/security/events" actions={[{label:'Governance preflight',path:'/security/governance/preflight',method:'GET'}]}/>}
