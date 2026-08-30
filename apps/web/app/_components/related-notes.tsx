'use client';

import Link from 'next/link';
import { Badge, Empty } from './page-ui';

type Note = { id?: string; title?: string | null; body?: string; updatedAt?: string; createdAt?: string };

export function RelatedNotes({ notes = [], title = 'یادداشت‌ها' }: { notes?: Note[]; title?: string }) {
  return <section className="panel related-notes"><div className="panel-title"><div><h2>{title}</h2><p>یادداشت‌های ثبت‌شده در این context</p></div><div className="toolbar"><Badge>{notes.length}</Badge><Link className="secondary-action" href="/notes">مشاهده همه</Link></div></div>{notes.length ? <div className="related-notes-list">{notes.slice(0, 8).map((note, index) => <article className="related-note" key={note.id ?? index}><div className="related-note-head"><strong>{note.title || 'یادداشت بدون عنوان'}</strong><small>{note.updatedAt || note.createdAt ? new Date(note.updatedAt ?? note.createdAt!).toLocaleString('fa-IR') : '—'}</small></div><p>{note.body || '—'}</p></article>)}</div> : <Empty>یادداشتی برای این context ثبت نشده است.</Empty>}</section>;
}
