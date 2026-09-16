'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, apiGet } from '../_lib/api';
import { useWorkspace } from '../_components/workspace';
import { Badge, ErrorCard, Loading, PageHeader, SectionCard } from '../_components/page-ui';
import { Bot, CircleHelp, MessageSquareText, Send, ShieldCheck, User } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════════════════
   دستیار پرسش‌وپاسخ طبیعی روی گراف (مسترپلن فاز ۳/۲۲) — الگوی Ask Introhive
   «سلامت این حساب چقدر است؟» بدون داشبورد — روی موتور قطعی موجود؛ همان
   لایهٔ MCP (آیتم ۱۵) برای انسان و هوش مصنوعی. الگوهای پرسش فارسی +
   پاسخ با ارجاع به رکورد منبع؛ «نمی‌دانم» صادقانه برای خارج از دامنه.
   ═══════════════════════════════════════════════════════════════════════════ */

type Ref = { type: string; id: string; label: string };
type Answer = { question: string; intent: string; intentFa?: string; answer: string; references?: Ref[]; outOfScope?: boolean; needsClarification?: boolean | null; detail?: unknown; _meta?: { engine: string; dataDate: string; disclaimer: string } };

const REF_FA: Record<string, string> = { ORGANIZATION: 'سازمان', RELATIONSHIP: 'رابطه', PERSON: 'شخص', COMMITMENT: 'تعهد', INTERACTION: 'تعامل', MENTION: 'ذکر رسانه‌ای', GAP: 'شکاف' };
const faDate = (v?: string | null) => v ? new Date(v).toLocaleDateString('fa-IR') : '';

export default function AssistantPage() {
  const { can } = useWorkspace();
  const [faq, setFaq] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState('');
  const [messages, setMessages] = useState<Answer[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await apiGet<{ items: string[]; capabilities: string }>('/assistant/suggestions');
        setFaq(r.items ?? []); setCapabilities(r.capabilities ?? '');
      } catch (e) { setError((e as Error).message); }
      finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages]);

  const ask = useCallback(async (q: string) => {
    const text = q.trim();
    if (!text || busy) return;
    setBusy(true); setError(''); setQuestion('');
    try {
      const r = await api<Answer>('/assistant/ask', { method: 'POST', body: JSON.stringify({ question: text }) });
      setMessages(prev => [...prev, r]);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }, [busy]);

  return (
    <>
      <PageHeader
        eyebrow="مسترپلن فاز ۳/۲۲ — الگوی Ask Introhive"
        title="دستیار پرسش‌وپاسخ گراف"
        description="پرسش‌های خود را به زبان طبیعی بپرسید — امتیاز و سلامت رابطه‌ها، مسیر معرفی، شکاف‌های پوشش، رسانه، تعهدات و افراد. پاسخ‌ها فقط از دادهٔ واقعی همین مستأجر و با ارجاع به رکورد منبع ساخته می‌شوند؛ برای خارج از دامنه صادقانه «نمی‌دانم» گفته می‌شود (بدون LLM)."
      />
      {error && <ErrorCard message={error} />}
      {loading ? <Loading /> : !can('ai.query') && !can('analytics.read') ? (
        <p className="pp-muted">برای استفاده از دستیار مجوز «دستیار هوشمند» لازم است.</p>
      ) : (
        <>
          <SectionCard title="گفت‌وگو" icon={<MessageSquareText size={16} />}
            description={capabilities ? `دامنهٔ پاسخ‌گویی: ${capabilities}.` : undefined}>
            <div className="as-chat" ref={listRef} aria-live="polite">
              {messages.length === 0 && (
                <div className="as-empty">
                  <CircleHelp size={20} />
                  <p style={{ margin: 0 }}>مثلاً بپرسید: «سلامت این حساب چقدر است؟» یا «مسیر معرفی از شرکت x به پارس انرژی چیست؟»</p>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className="as-turn">
                  <div className="as-q"><User size={14} style={{ flexShrink: 0 }} /><span>{m.question}</span></div>
                  <div className={`as-a ${m.outOfScope ? 'as-oos' : ''}`}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Bot size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{m.answer}</p>
                    </div>
                    <div className="as-meta">
                      {m.intentFa && <Badge tone={m.outOfScope ? 'warning' : m.needsClarification ? 'info' : 'neutral'}>{m.intentFa}</Badge>}
                      {m.references && m.references.length > 0 && m.references.slice(0, 6).map((r, j) => (
                        <span key={j} className="p3-chip" title={`${REF_FA[r.type] ?? r.type}: ${r.id}`}>{REF_FA[r.type] ?? r.type} — {String(r.label).slice(0, 34)}</span>
                      ))}
                      {m._meta?.dataDate && <span className="as-date"><ShieldCheck size={11} style={{ verticalAlign: '-1px' }} /> داده تا {faDate(m._meta.dataDate)}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {busy && <div className="as-a as-typing"><Bot size={15} /><span>در حال بررسی گراف…</span></div>}
            </div>
            <form style={{ display: 'flex', gap: 8, marginTop: 10 }} onSubmit={e => { e.preventDefault(); void ask(question); }}>
              <input
                className="as-input" value={question} onChange={e => setQuestion(e.target.value)}
                placeholder="پرسش خود را بنویسید…" aria-label="پرسش از دستیار" maxLength={500}
                disabled={busy}
              />
              <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}><Send size={14} /> بپرس</button>
            </form>
          </SectionCard>

          <SectionCard title="پرسش‌های پرتکرار" icon={<CircleHelp size={16} />}
            description="با یک کلیک اجرا می‌شوند — هر پاسخ با ارجاع به رکورد منبع ارائه می‌شود.">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {faq.map(q => (
                <button key={q} className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void ask(q)}>{q}</button>
              ))}
            </div>
          </SectionCard>
        </>
      )}
    </>
  );
}
