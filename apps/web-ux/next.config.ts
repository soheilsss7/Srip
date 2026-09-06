import type {NextConfig} from 'next';

const isProd=process.env.NODE_ENV==='production';
const isPages=process.env.SRIP_PAGES==='1';
const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
  // X-Frame-Options and HSTS are applied only in production: dev/preview
  // environments embed the app in an iframe (live preview), and HSTS has no
  // meaning over http. Production keeps the strict posture.
  ...(isProd?[
    {key:'X-Frame-Options',value:'DENY'},
    {key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'},
  ]:[]),
];
// When NEXT_PUBLIC_API_URL is unset (or relative), the browser calls the
// same-origin /api/v1 and Next dev/prod proxies it to the real API target.
const apiBase = process.env.NEXT_PUBLIC_API_URL;
const useSameOriginProxy = !apiBase || apiBase.startsWith('/');
const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:4000';

const config:NextConfig={
  poweredByHeader:false,
  reactStrictMode:true,
  output:isPages?'export':undefined,
  basePath:isPages?'/Srip/srip2':'',
  // buildId تصادفی Next هر release را به یک diff ۶۰۰+ فایلی (فقط تغییر نام
  // پوشهٔ _next/static) تبدیل می‌کرد؛ ثابت‌کردن آن، diff را به تغییر واقعی
  // محتوا محدود می‌کند — برای نسخهٔ استاتیک (GitHub Pages) کاملاً امن است.
  generateBuildId: async () => (isPages ? 'srip2' : 'dev'),
  images:{unoptimized:true},
  async headers(){return [{source:'/:path*',headers:securityHeaders}]},
  ...(useSameOriginProxy && !isPages ? {
    async rewrites(){
      return [{ source:'/api/v1/:path*', destination:`${apiProxyTarget}/api/v1/:path*` }];
    },
  } : {}),
};
export default config;
