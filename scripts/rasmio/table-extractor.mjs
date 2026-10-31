// Serializable for Puppeteer.evaluate: no dependencies outside the function.
export function extractTablesFromDOM(root = document) {
  const text = node => (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
  const rows = [], tables = [], seen = new Set();
  for (const table of root.querySelectorAll('table')) {
    const columns = [...table.querySelectorAll('thead th')].map(text);
    const header = columns.join(' | ');
    const allRows = [], cellSpans = [];
    for (const tr of table.querySelectorAll('tbody tr')) {
      const cellsDOM = [...tr.querySelectorAll('td')];
      const cells = cellsDOM.map(text); // Preserve blank positions and every column.
      if (cells.some(Boolean)) {
        allRows.push(cells);
        cellSpans.push(cellsDOM.map(td => ({ colSpan: td.colSpan || 1, rowSpan: td.rowSpan || 1 })));
      }
      for (const link of tr.querySelectorAll('a[href*="/person/"], a[href*="/company/"]')) {
        const href = link.getAttribute('href');
        const key = JSON.stringify([href, header, cells]);
        if (seen.has(key)) continue;
        seen.add(key);
        rows.push({ header, href, name: text(link), cells });
      }
    }
    if (allRows.length) tables.push({ header, columns, rows: allRows, cellSpans });
  }
  return { title: text(root.querySelector('h1') || {}) || (root.title || '').trim(), rows, tables };
}

// Linked rows are not required: financial/product/capital tables can contain no entity links.
export function hasParsedDetail(parsed) {
  return !!parsed && ((parsed.rows || []).length>0 || (parsed.tables || []).some(t=>(t.rows || []).length>0));
}
