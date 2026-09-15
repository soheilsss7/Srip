'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard, StatCard } from '../_components/page-ui';
import { Bot, Play, Server, ShieldCheck, Terminal } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   سرور MCP فقط-خواندنی (مسترپلن فاز ۲/۱۵) — الگوی Altify/4Degrees/Introhive
   POST /mcp  (JSON-RPC 2.0: initialize / tools/list / tools/call)
   ۶ ابزار: search_graph · stakeholder_profile · relationship_score ·
            suggested_path · public_gaps · media_mentions
   هر پاسخ با شناسهٔ منبع و تاریخ داده — سازگار با موتور قطعی، بدون توهم.
   این صفحه = سند برنامه‌نویس + کنسول آزمایش.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tool = { name: string; description: string; inputSchema: any };
type RpcResult = { jsonrpc: '2.0'; id: number; result?: any; error?: { code: number; message: string } };

const fmtN = (v: unknown) => (v === null || v === undefined || v === '') ? '—' : new Intl.NumberFormat('fa-IR').format(Number(v));

const TOOL_FA: Record<string, string> = {
  search_graph: 'جست‌وجوی گراف', stakeholder_profile: 'پروفایل ذینفع', relationship_score: 'امتیاز رابطه',
  suggested_path: 'مسیر پیشنهادی', public_gaps: 'شکاف‌های عمومی', media_mentions: 'ذکرهای رسانه‌ای',
};
const SAMPLE_ARGS: Record<string, Record<string, string>> = {
  search_graph: { query: 'شریف' },
  stakeholder_profile: { organizationId: 'org-pars' },
  relationship_score: { fromOrganizationId: 'org-pars', toOrganizationId: 'org-pars-01' },
  suggested_path: { from: 'org-pars', to: 'org-ac-sharif' },
  public_gaps: { organizationId: 'org-pars' },
  media_mentions: { organizationId: 'org-ac-sharif' },
};

const CODE_SAMPLE = `# اتصال با هر کلاینت MCP استاندارد (Streamable HTTP)
# ۱) نشست: توکن دسترسی SRIP را در هدر Authorization بگذارید
curl -X POST https://<host>/api/v1/mcp \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer <access-token>' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize"}'

# ۲) فهرست ابزارها
curl -X POST .../api/v1/mcp -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# ۳) فراخوانی ابزار — پاسخ همیشه content (متن JSON) و structuredContent دارد
curl -X POST .../api/v1/mcp \\
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call",
       "params":{"name":"search_graph","arguments":{"query":"شریف"}}}'

# ۴) کلاینت نمونهٔ آماده:
node scripts/mcp-client.mjs   # ۱۰ پرسش استاندارد + خروجی سبز/قرمز`;

export default function McpPage() {
  const { me } = useWorkspace();
  const [info, setInfo] = useState<{ tools: Tool[]; serverInfo: any; methods: string[]; usage: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tool, setTool] = useState('search_graph');
  const [argsText, setArgsText] = useState(JSON.stringify(SAMPLE_ARGS['search_graph'], null, 1));
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<{ q: string; ok: boolean }[]>([]);

  useEffect(() => {
    (async () => {
      try { setInfo(await api<any>('/mcp')); }
      catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  const run = useCallback(async (name: string, args: Record<string, unknown>, label?: string) => {
    setRunning(true); setError('');
    try {
      const out = await api<RpcResult>('/mcp', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } }) });
      const sc = out.result?.structuredContent;
      setOutput(JSON.stringify(sc ?? out, null, 1));
      setLog(l => [{ q: label ?? `${name}(${JSON.stringify(args)})`, ok: !!(sc?._meta || out.result) }, ...l].slice(0, 12));
    } catch (e) { setError((e as Error).message); setLog(l => [{ q: label ?? name, ok: false }, ...l].slice(0, 12)); }
    finally { setRunning(false); }
  }, []);

  const runConsole = async () => {
    let args: Record<string, unknown> = {};
    try { args = argsText.trim() ? JSON.parse(argsText) : {}; }
    catch { setError('بدنهٔ آرگومان‌ها JSON معتبر نیست.'); return; }
    await run(tool, args);
  };

  return (
    <>
      <PageHeader
        eyebrow="مسترپلن فاز ۲/۱۵ — الگوی Altify v9.18 / 4Degrees"
        title="سرور MCP (اتصال به ChatGPT/Claude)"
        description="ابزارهای فقط-خواندنی روی گراف روابط، امتیازها، مسیرها و شکاف‌ها — هر پاسخ با شناسهٔ منبع و تاریخ داده از دادهٔ واقعی همین مستأجر ساخته می‌شود؛ بدون توهم."
      />
      {error && <ErrorCard message={error} />}
      {loading ? <Loading /> : info && (
        <>
          <div className="stat-grid">
            <StatCard icon={<Server size={18} />} label="پروتکل" value="MCP · JSON-RPC 2.0" iconClass="ic-blue" sub={info.serverInfo?.name + ' ' + (info.serverInfo?.version ?? '')} />
            <StatCard icon={<Bot size={18} />} label="ابزارهای فقط-خواندنی" value={fmtN(info.tools.length)} iconClass="ic-teal" sub="نوشتن از راه MCP ممکن نیست" />
            <StatCard icon={<ShieldCheck size={18} />} label="ضدتوهم" value="شناسهٔ منبع + تاریخ" iconClass="ic-indigo" sub="هر پاسخ با _meta" />
          </div>

          <SectionCard title="کنسول آزمایش ابزارها" icon={<Terminal size={16} />}
            description="ابزار و آرگومان‌ها را انتخاب کنید؛ همان فراخوانی JSON-RPC که کلاینت MCP استاندارد می‌فرستد اینجا اجرا می‌شود.">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <label className="field" style={{ margin: 0, minWidth: 200 }}>
                <span className="field-label">ابزار</span>
                <select value={tool} onChange={e => { setTool(e.target.value); setArgsText(JSON.stringify(SAMPLE_ARGS[e.target.value] ?? {}, null, 1)); }}>
                  {info.tools.map(t => <option key={t.name} value={t.name}>{TOOL_FA[t.name] ?? t.name}</option>)}
                </select>
              </label>
              <label className="field" style={{ margin: 0, flex: '1 1 260px' }}>
                <span className="field-label">آرگومان‌ها (JSON)</span>
                <textarea rows={3} value={argsText} onChange={e => setArgsText(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 11.5, direction: 'ltr' }} />
              </label>
              <button className="btn btn-primary" style={{ alignSelf: 'flex-end' }} disabled={running} onClick={runConsole}>
                <Play size={13} /> {running ? 'در حال اجرا…' : 'اجرای ابزار'}
              </button>
            </div>
            {output && (
              <pre style={{ marginTop: 12, background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.8, overflow: 'auto', maxHeight: 320, direction: 'ltr' }}
                aria-label="خروجی ابزار">{output}</pre>
            )}
          </SectionCard>

          <SectionCard title="۱۰ پرسش استاندارد (نمونهٔ کلاینت)" icon={<Play size={16} />}
            description="همان سناریویی که scripts/mcp-client.mjs اجرا می‌کند — اینجا هم قابل اجراست.">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('search_graph', { query: 'شریف' }, 'دانشگاه شریف را پیدا کن')}>دانشگاه شریف را پیدا کن</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('search_graph', { query: 'وزارت' }, 'نهادهای وزارتی')}>نهادهای وزارتی</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('stakeholder_profile', { organizationId: 'org-pars' }, 'پروفایل هلدینگ پارس')}>پروفایل پارس</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('relationship_score', { fromOrganizationId: 'org-pars', toOrganizationId: 'org-pars-01' }, 'امتیاز رابطهٔ پارس انرژی')}>امتیاز رابطه</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('suggested_path', { from: 'org-pars', to: 'org-ac-sharif' }, 'مسیر تا شریف')}>مسیر پیشنهادی</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('public_gaps', { organizationId: 'org-pars' }, 'شکاف‌های عمومی پارس')}>شکاف‌های عمومی</button>
              <button className="btn btn-secondary btn-sm" disabled={running} onClick={() => run('media_mentions', { organizationId: 'org-ac-sharif' }, 'پوشش رسانه‌ای شریف')}>پوشش رسانه‌ای</button>
            </div>
            {log.length > 0 && (
              <ul style={{ margin: '10px 0 0', paddingInlineStart: 16, display: 'grid', gap: 4 }}>
                {log.map((l, i) => <li key={i} style={{ fontSize: 12 }}><Badge tone={l.ok ? 'success' : 'danger'}>{l.ok ? 'اجرای موفق' : 'خطا'}</Badge> {l.q}</li>)}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="سند برنامه‌نویس" icon={<Server size={16} />}
            description="روش اتصال برای توسعه‌دهندگان — سازگار با کلاینت‌های MCP استاندارد (Streamable HTTP).">
            <pre style={{ background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 1.9, overflow: 'auto', direction: 'ltr' }}>{CODE_SAMPLE}</pre>
            <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
              {info.tools.map(t => (
                <div key={t.name} className="listRow" style={{ alignItems: 'flex-start' }}>
                  <Badge tone="info">{TOOL_FA[t.name] ?? t.name}</Badge>
                  <span style={{ flex: 1 }}>
                    <strong style={{ fontSize: 12 }}>{t.name}</strong>
                    <p style={{ margin: '3px 0 0', fontSize: 11.5, lineHeight: 1.8 }}>{t.description}</p>
                    <code style={{ fontSize: 10, color: '#64748b', direction: 'ltr', display: 'block', marginTop: 3 }}>
                      {JSON.stringify(t.inputSchema?.properties ?? {})}
                    </code>
                  </span>
                </div>
              ))}
            </div>
            <p className="t-muted" style={{ fontSize: 11, marginTop: 10 }}>
              <ShieldCheck size={12} style={{ verticalAlign: -2 }} /> حاکمیت: پاسخ‌ها فقط از دادهٔ محدودهٔ دسترسی همان توکن ساخته می‌شوند؛
              هیچ ابزاری برای نوشتن/تغییر داده وجود ندارد و هر پاسخ ساختار <code>_meta</code> با تاریخ داده و شناسهٔ منابع دارد.
            </p>
          </SectionCard>
        </>
      )}
    </>
  );
}
