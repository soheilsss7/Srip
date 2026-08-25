import Link from 'next/link';
export default function NotFound(){return <main className="error-page"><section className="route-error"><strong>صفحه پیدا نشد</strong><p>مسیر در این Workspace وجود ندارد یا برای شما قابل دسترسی نیست.</p><Link className="primary-action" href="/">بازگشت به داشبورد</Link></section></main>}
