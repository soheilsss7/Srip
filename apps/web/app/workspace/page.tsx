'use client';
import {PageHeader,Empty} from '../_components/page-ui';
import {useWorkspace} from '../_components/workspace';
const groups=[['Core','organizations','people','relationships','meetings'],['Execution','actions','commitments','projects','opportunities'],['Intelligence','network','search','intelligence','recommendations'],['Governance','admin','approvals','workflows','integrations'],['Operations','notifications','reports','data-management','notes']];
const permissions:Record<string,string>={organizations:'org.read',people:'person.read',relationships:'relationship.read',meetings:'meeting.read',actions:'action.read',commitments:'commitment.read',projects:'project.read',opportunities:'opportunity.read',network:'network.read',search:'search.read',intelligence:'relationship.read',recommendations:'recommendation.read',admin:'enterprise.admin',approvals:'approval.read',workflows:'workflow.read',integrations:'integration.read',notifications:'entity.read',reports:'report.read','data-management':'data.quality.read',notes:'entity.read'};
export default function Workspace(){
 const {can}=useWorkspace();
 return <main className="feature-page"><PageHeader eyebrow="WORKSPACE" title="مرکز عملیات" description="نقطه ورود یکپارچه به حوزه‌های عملیاتی پلتفرم تعاملات."/><div className="dashboard-grid">{groups.map(g=>{const links=g.slice(1).filter(x=>can(permissions[x]));return <section className="panel" key={g[0]}><h2>{g[0]}</h2>{links.length?<div className="workspace-links">{links.map(x=><a key={x} href={'/'+x}>{x}</a>)}</div>:<Empty>ماژولی با مجوز فعلی در این گروه وجود ندارد.</Empty>}</section>})}</div></main>
}
