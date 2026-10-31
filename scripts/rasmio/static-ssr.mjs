// React streaming SSR needs its inline continuation scripts to assemble table
// fragments. Keep those scripts enabled, but fail external network loads fast.
// Restore connectivity before any real browser fallback/navigation.
export async function readStaticSSR(page,html,parse){
 await page.setOfflineMode(true);
 try{
  await page.setContent(html,{waitUntil:'domcontentloaded',timeout:20_000});
  await new Promise(resolve=>setTimeout(resolve,100));
  return await parse(page);
 }finally{await page.setOfflineMode(false);}
}
