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
