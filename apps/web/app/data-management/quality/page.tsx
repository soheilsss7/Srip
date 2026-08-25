import { OpsWorkspace } from '../../_components/ops-workspace';
export default function Page(){return <OpsWorkspace title="Data Quality" eyebrow="DATA MANAGEMENT" description="Duplicate Records، Missing Owners، Missing Contacts، Stale Relationships، Invalid Emails و پروفایل‌های ناقص." endpoint="/data/quality" actions={[{label:'Quality Scan',path:'/data/quality/scan'}]}/>}
