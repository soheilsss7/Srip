import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectRrkHTML} from './rrk-probe.mjs';
test('identifies public search and CAPTCHA without exposing form token values',()=>{
 const x=inspectRrkHTML('<title>آگهی</title><form><input name="__VIEWSTATE" value="secret-token"><input name="nationalId">شناسه ملی کد امنیتی</form>');
 assert.equal(x.forms,1);assert.equal(x.captchaIndicated,true);assert.equal(x.nationalIdSearchIndicated,true);assert.ok(!JSON.stringify(x).includes('secret-token'));
});
test('does not mistake a search page for extracted advertisements or relationships',()=>{
 const x=inspectRrkHTML('<title>جستجو</title><a href="ShowNews.aspx?Code=123">آگهی</a>');
 assert.equal(x.advertLinks.length,1);assert.equal(x.captchaIndicated,false);assert.equal(x.relationshipsExtracted,undefined);
});

test('recognizes the modern Oracle APEX application without retaining session values',()=>{
 const x=inspectRrkHTML('<input name="p_flow_id" value="200"><input name="p_instance" value="private-session"><span id="P28_SABTNATIONALID_DISPLAY">company</span><a href="/ords/r/rrs/rrs-front/f-detail-ad?x=1">آگهی</a>');
 assert.equal(x.oracleApexIndicated,true);assert.equal(x.advertLinks.length,1);assert.ok(!JSON.stringify(x).includes('private-session'));
});
