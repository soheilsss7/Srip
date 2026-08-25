export type Pagination = { page: number; pageSize: number; skip: number; take: number };

export function parsePagination(page?: string | number, pageSize?: string | number, defaults = { page: 1, pageSize: 50 }): Pagination {
  const p = Math.max(1, Number(page ?? defaults.page) || defaults.page);
  const s = Math.min(100, Math.max(1, Number(pageSize ?? defaults.pageSize) || defaults.pageSize));
  return { page: p, pageSize: s, skip: (p - 1) * s, take: s };
}
