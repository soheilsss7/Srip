export class SensitiveDataSanitizer {
  private static readonly blocked = /password|passwd|token|secret|api[-_]?key|authorization|cookie|set-cookie|private[-_]?key|client[-_]?secret|refresh[-_]?token|access[-_]?token|rawbody|requestbody|document|credential|signature/i;
  static sanitize<T = unknown>(value: T, rootKey = ''): T { return this.walk(value, rootKey, 0) as T; }
  private static walk(value: unknown, key: string, depth: number): unknown {
    if (SensitiveDataSanitizer.blocked.test(key)) return '[REDACTED]';
    if (depth > 8) return '[TRUNCATED_DEPTH]';
    if (Array.isArray(value)) return value.slice(0,100).map(v=>SensitiveDataSanitizer.walk(v,key,depth+1));
    if (value && typeof value === 'object') { const out:Record<string,unknown>={}; for (const [k,v] of Object.entries(value as Record<string,unknown>).slice(0,200)) out[k]=SensitiveDataSanitizer.walk(v,k,depth+1); return out; }
    if (typeof value === 'string' && value.length>2000) return `${value.slice(0,2000)}…`;
    return value;
  }
  static sanitizeSql(sql: unknown): string { const v=String(sql??'').replace(/\s+/g,' ').trim(); return v.length>1000?`${v.slice(0,1000)}…`:v; }
}
