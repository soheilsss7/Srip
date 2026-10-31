import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {permittedArchiveEntry,archivedHTML} from './rrk-archive-probe.mjs';
const entry={url:'http://www.rrk.ir/News/ShowOldNews.aspx?Code=123',status:'200',filename:'crawl-data/CC-MAIN-2020-50/segments/1606141176864.5/warc/CC-MAIN-123.warc.gz',offset:'0',length:'1000'};
test('archive entries are scoped to official notice URLs and bounded WARC ranges',()=>{
 assert.equal(permittedArchiveEntry(entry),true);
 for(const e of [{...entry,url:'https://evil.test/'},{...entry,filename:'../../secret'},{...entry,length:'999999999'},{...entry,url:'https://www.rrk.ir/Shop/ShowProduct.aspx?Code=1'}])assert.equal(permittedArchiveEntry(e),false);
});
test('archive identity and HTTP status are verified before text is parsed',()=>{
 const body='<html>synthetic test only</html>';const http='HTTP/1.1 200 OK\r\nContent-Type: text/html\r\n\r\n'+body;
 const warc=`WARC/1.0\r\nWARC-Type: response\r\nWARC-Target-URI: ${entry.url}\r\nContent-Length: ${Buffer.byteLength(http)}\r\n\r\n${http}\r\n\r\n`;
 assert.equal(archivedHTML(gzipSync(warc),entry),body);
 assert.throws(()=>archivedHTML(gzipSync(warc.replace(entry.url,'http://www.rrk.ir/other')),entry),/identity/);
 assert.throws(()=>archivedHTML(gzipSync(warc.replace('200 OK','403 No')),entry),/200/);
});
test('compressed, chunked and Common Crawl pre-decoded payloads are supported',()=>{
 const html=Buffer.from('<html>synthetic transport fixture</html>');
 const wrap=(payload,headers)=>{const http=Buffer.concat([Buffer.from(`HTTP/1.1 200 OK\r\n${headers}\r\n\r\n`),payload]);return gzipSync(Buffer.concat([Buffer.from(`WARC/1.0\r\nWARC-Type: response\r\nWARC-Target-URI: ${entry.url}\r\nContent-Length: ${http.length}\r\n\r\n`),http]));};
 assert.equal(archivedHTML(wrap(gzipSync(html),'Content-Encoding: gzip'),entry),html.toString());
 assert.equal(archivedHTML(wrap(html,'Content-Encoding: gzip'),entry),html.toString());
 const chunked=Buffer.concat([Buffer.from(html.length.toString(16)+'\r\n'),html,Buffer.from('\r\n0\r\n\r\n')]);
 assert.equal(archivedHTML(wrap(chunked,'Transfer-Encoding: chunked'),entry),html.toString());
 assert.throws(()=>archivedHTML(wrap(Buffer.from('ff\r\nshort'),'Transfer-Encoding: chunked'),entry),/chunk/);
});
test('listing evidence retains source scope and does not infer complete notices or unlabelled identities',async()=>{
 const {parseArchivedListingRows}=await import('./rrk-archive-probe.mjs');
 const row={href:'ShowNews.aspx?Code=123',text:'Synthetic company evidence 1234567890',cells:['Synthetic company','10260492051'],headers:['نام شرکت','شناسه ملی']};
 const e={...entry,url:'http://www.rrk.ir/News/NewsList.aspx',kind:'notice-listing',timestamp:'20171212140839',collection:'CC-MAIN-2017-51'};
 assert.equal(permittedArchiveEntry(e),true);
 const [a]=parseArchivedListingRows([row],e,'a'.repeat(64));assert.equal(a.companyNationalId,'10260492051');assert.equal(a.verification.fullNoticeVerified,false);assert.equal(a.text.includes('1234567890'),false);
 assert.equal(parseArchivedListingRows([{...row,headers:[]}],e,'a')[0].companyNationalId,null);
 assert.equal(parseArchivedListingRows([{...row,href:'https://evil.test/News/ShowNews.aspx?Code=123'}],e,'a').length,0);
 assert.throws(()=>parseArchivedListingRows([row,{...row,text:'conflicting synthetic text'}],e,'a'),/Conflicting/);
});
