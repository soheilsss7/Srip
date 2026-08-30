import type {NextConfig} from 'next';

const isProd=process.env.NODE_ENV==='production';
const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  {key:'Cross-Origin-Resource-Policy',value:'same-origin'},
  ...(isProd?[{key:'Strict-Transport-Security',value:'max-age=31536000; includeSubDomains'}]:[]),
];
const useSameOriginApi=!process.env.NEXT_PUBLIC_API_URL||process.env.NEXT_PUBLIC_API_URL.startsWith('/');
const apiProxyTarget=process.env.API_PROXY_TARGET??'http://localhost:4000';
const config:NextConfig={
  poweredByHeader:false,
  reactStrictMode:true,
  async rewrites(){
    if(!useSameOriginApi)return [];
    return [
      {source:'/api/v1/:path*',destination:`${apiProxyTarget}/api/v1/:path*`},
      {source:'/docs-json',destination:`${apiProxyTarget}/docs-json`},
    ];
  },
  async headers(){return [{source:'/:path*',headers:securityHeaders}]},
};
export default config;
