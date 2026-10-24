import { pageIds } from '../../_lib/pages-ids';

export function generateStaticParams() {
  return pageIds.people.map((id) => ({ id }));
}

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
