import { pageIds } from '../../_lib/pages-ids';

export function generateStaticParams() {
  return pageIds.commitments.map((id) => ({ id }));
}

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
