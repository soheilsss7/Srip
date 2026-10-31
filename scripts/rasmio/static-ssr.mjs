// Parse the fetched public server HTML, not a hydrated network page. Executing
// third-party scripts here can hang or replace the server markup. The separate
// browser fallback is still available, with the original JS setting restored.
export async function readStaticSSR(page,html,parse){
 const previous=page.isJavaScriptEnabled();
 await page.setJavaScriptEnabled(false);
 try{await page.setContent(html,{waitUntil:'domcontentloaded',timeout:20_000});return await parse(page);}
 finally{await page.setJavaScriptEnabled(previous);}
}
