// Real Chromium interaction with the current app. The test response exposes its
// logic instance for seeding one source and inspecting export state; the repo is untouched.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
const fs=require('fs'),path=require('path'); const server=require('http').createServer((req,res)=>{const file=path.join(path.resolve(__dirname,'..'),req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');let body=fs.readFileSync(file); if(file.endsWith('index.html')) body=body.toString().replace('componentDidMount() {','componentDidMount() { window.__app = this;');res.end(body);}catch(e){res.statusCode=404;res.end('missing');}}); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']});
try {
const page=await browser.newPage();page.setDefaultTimeout(8000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
if (process.env.REACT_VENDOR_DIR) for(const f of ['react.production.min.js','react-dom.production.min.js','babel.min.js']) await page.addInitScript({path:path.join(process.env.REACT_VENDOR_DIR,f)});
await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForTimeout(3000);
await page.waitForFunction(()=>window.__app); await page.evaluate(()=>window.__app.setState({view:'draft',added:{custom:[{id:1001,title:'Test note',type:'Notes',text:'This is a note.',year:2026}]}}));
await page.getByRole('button',{name:'+ Add thought',exact:true}).click();
await page.getByPlaceholder('Write a thought or claim…').fill('Maybe these companies coordinate.'); await page.waitForTimeout(650);
let state=await page.evaluate(()=>({claims:window.__app.pinData().claims, out:window.__app.draftVals(window.__app.analysis()).out}));
if(state.out.has) throw Error('Thought leaked into report');
await page.getByRole('combobox',{name:'Ground or exploratory state'}).selectOption('analysis');
await page.getByRole('textbox',{name:'Who owns this statement'}).fill('Elena'); await page.getByRole('textbox',{name:'Ground and search scope'}).click();
await page.getByRole('textbox',{name:'Ground and search scope'}).fill('My interpretation of the procurement pattern'); await page.getByText('No counter-ground has been admitted yet.',{exact:true}).click();
state=await page.evaluate(()=>({claims:window.__app.pinData().claims, out:window.__app.draftVals(window.__app.analysis()).out}));
if(!state.out.status.includes('Ready to export') || !state.out.notes.some(n=>n.text.includes('Elena'))) throw Error('Owned statement/export lost authorship');
await page.getByPlaceholder('Write a thought or claim…').fill('These companies coordinated all bidding.');await page.waitForTimeout(650);
state=await page.evaluate(()=>window.__app.draftVals(window.__app.analysis()).out);
if(!state.status.includes('blocked')) throw Error('Edited ownership was reused');
console.log('PASS: thought excluded; explicit ownership exported with giver and scope; editing invalidates ownership');
await page.getByRole('button',{name:'Ground',exact:true}).click();
state=await page.evaluate(()=>window.__app.draftVals(window.__app.analysis()).out);
if(!state.status.includes('blocked')) throw Error('Failed search acquired implicit ownership');
await page.getByRole('combobox',{name:'Ground or exploratory state'}).selectOption('absence');
state=await page.evaluate(()=>window.__app.draftVals(window.__app.analysis()).out);
// The existing analysis note is not a documented search; replace it deliberately.
await page.getByRole('textbox',{name:'Ground and search scope'}).fill(''); await page.getByRole('textbox',{name:'Who owns this statement'}).click();
state=await page.evaluate(()=>window.__app.draftVals(window.__app.analysis()).out);
if(!state.status.includes('blocked')) throw Error('Absence with no search note exported');
await page.getByRole('textbox',{name:'Ground and search scope'}).fill('Searched coordination in the one loaded test note, October 2026'); await page.getByRole('textbox',{name:'Who owns this statement'}).click();
state=await page.evaluate(()=>window.__app.draftVals(window.__app.analysis()).out);
if(!state.status.includes('Ready to export')) throw Error('Documented absence did not retain scope');
console.log('PASS: failed matching stays unowned; absence requires a documented search');
await page.evaluate(async()=>{
  const M=await import('/holodeck-map.js'); const host=document.createElement('div'); host.style.cssText='position:fixed;inset:0;background:#141126;z-index:999';document.body.append(host);
  const lines=[]; const move=CanvasRenderingContext2D.prototype.moveTo, line=CanvasRenderingContext2D.prototype.lineTo;
  CanvasRenderingContext2D.prototype.moveTo=function(x,y){this._start=[x,y];return move.call(this,x,y)};
  CanvasRenderingContext2D.prototype.lineTo=function(x,y){if(this._start) {lines.push({x1:this._start[0],y1:this._start[1],x2:x,y2:y});if(lines.length>100) lines.shift();}return line.call(this,x,y)};
  window.__mapLines=lines;
  const map=M.mountMap(host,{onWitness:o=>window.__seenWitness=o});
  map.set({nodes:[{n:'Elena',c:2},{n:'Vendor',c:2}],edges:[{a:'Elena',b:'Vendor',c:2}],docs:[{id:1,title:'Procurement note'}],occ:new Map([['Elena',[{doc:1,id:1,t:'Elena met Vendor.'}]],['Vendor',[{doc:1,id:1,t:'Elena met Vendor.'}]]])});window.__testMap=map;
});
await page.locator('.hm [data-lv=down]').click(); await page.waitForTimeout(150);
if(!(await page.locator('.hm-position').innerText()).includes('Centered on')) throw Error('Map center invisible');
const edge=await page.evaluate(()=>window.__mapLines.at(-1));
await page.mouse.click((edge.x1+edge.x2)/2,(edge.y1+edge.y2)/2);
await page.getByText('Why this connection exists',{exact:true}).waitFor();
await page.locator('[data-witness]').click();
if(!(await page.evaluate(()=>window.__seenWitness?.id===1))) throw Error('Edge witness not navigable');
console.log('PASS: named map origin; edge ground opens its exact source statement');
await page.evaluate(()=>window.__testMap.destroy());

if(errors.length) throw Error(errors.join('; '));
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1});

