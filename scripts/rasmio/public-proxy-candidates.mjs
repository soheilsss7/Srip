import { isIP, BlockList } from 'node:net';
const blocked = new BlockList();
for (const [net, bits] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.168.0.0',16],['192.0.0.0',24],['192.0.2.0',24],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) blocked.addSubnet(net,bits,'ipv4');
export function parsePublicProxy(line) {
  try {
    const raw = line.trim();
    const explicitPort = raw.match(/:(\d+)\/?$/)?.[1];
    const u = new URL(raw);
    if (!['http:','https:','socks4:','socks5:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || !['','/'].includes(u.pathname)) return null;
    if (isIP(u.hostname)!==4 || blocked.check(u.hostname,'ipv4') || !explicitPort || Number(explicitPort)<1 || Number(explicitPort)>65535) return null;
    return { url: `${u.protocol}//${u.hostname}:${Number(explicitPort)}`, host: u.hostname, protocol: u.protocol.slice(0,-1) };
  } catch { return null; }
}
export function interleaveCandidates(lists, limit=20) {
  const result=[], seen=new Set();
  for(let i=0;result.length<limit && lists.some(l=>i<l.length);i++) {
    for(const list of lists) {
      const p=parsePublicProxy(list[i] || '');
      if(p && !seen.has(p.host)) { seen.add(p.host);result.push(p); }
      if(result.length>=limit) break;
    }
  }
  return result;
}
export function proxyCurlArgs(proxy, url) {
  const p=parsePublicProxy(proxy);
  if(!p || !['https://api.ipify.org/?format=json','https://rasmio.com/company/10100000711'].includes(url)) throw new Error('Proxy or probe target is not permitted');
  const endpoint=p.url.replace(/^socks5:/,'socks5h:').replace(/^socks4:/,'socks4a:');
  return ['-q','--silent','--show-error','--fail','--proxy',endpoint,'--noproxy','','--proto','=https','--proto-redir','=https','--max-redirs','0','--connect-timeout','4','--max-time','8','--max-filesize','2097152','--user-agent','Mozilla/5.0 (compatible; PublicDetailConnectivityTest/1.0)',url];
}
