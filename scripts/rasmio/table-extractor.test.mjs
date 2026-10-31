import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTablesFromDOM, hasParsedDetail } from './table-extractor.mjs';
const link = (href, name) => ({innerText:name,getAttribute:()=>href});
function fixture(headers, records) {
 const table={querySelectorAll:s=> s==='thead th' ? headers.map(innerText=>({innerText})) : records.map(({cells,links=[]})=>({querySelectorAll:s=>s==='td'?cells.map(innerText=>({innerText})):links}))};
 return {title:'Example',querySelector:()=>null,querySelectorAll:()=>[table]};
}
test('preserves empty columns and columns beyond 10',()=>{
 const cells=Array.from({length:17},(_,i)=>i===1?'':`v${i}`);
 const data=extractTablesFromDOM(fixture(cells.map((_,i)=>'h'+i),[{cells,links:[link('/company/1','A')]}]));
 assert.deepEqual(data.tables[0].rows[0],cells);
 assert.equal(data.tables[0].columns.length,17);
 assert.equal(data.rows[0].cells.length,17);
 assert.equal(data.rows[0].cells[1],'');
});
test('retains multiple links and distinct roles for the same entity',()=>{
 const d=extractTablesFromDOM(fixture(['Name','Role'],[
 {cells:['A','director'],links:[link('/company/1','A'),link('/person/2','B')]},
 {cells:['A','auditor'],links:[link('/company/1','A')]},
 {cells:['A','auditor'],links:[link('/company/1','A')]}
 ]));
 assert.equal(d.rows.length,3); assert.equal(d.tables[0].rows.length,3);
});

test('table-only SSR is detail, avoiding duplicate browser navigation; shells are not',()=>{
 assert.equal(hasParsedDetail({rows:[],tables:[{rows:[['financial value']]}]}),true);
 assert.equal(hasParsedDetail({rows:[{}],tables:[]}),true);
 for(const p of [null,{}, {rows:[],tables:[]},{rows:[],tables:[{rows:[]}]}])assert.equal(hasParsedDetail(p),false);
});
