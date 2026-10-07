const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=require('http').createServer((req,res)=>{const f=path.join(root,decodeURIComponent(req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]));try{res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.json')?'application/json':'text/html');let body=fs.readFileSync(f);if(f.endsWith('index.html')) body=body.toString().replace('componentDidMount() {','componentDidMount() { window.__app=this;');res.end(body);}catch{res.statusCode=404;res.end('missing');}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); page.setDefaultTimeout(8000); const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.REACT_VENDOR_DIR) for(const f of ['react.production.min.js','react-dom.production.min.js','babel.min.js']) await page.addInitScript({path:path.join(process.env.REACT_VENDOR_DIR,f)});
 await page.route(/fonts\.(googleapis|gstatic)\.com/,r=>r.abort());
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.__app,{timeout:20000});
await page.evaluate(()=>{localStorage.setItem('fold-explorer-theme','light');window.__app.setState({theme:'light',corpus:'custom',view:'summary',railOpen:true,added:{custom:[{id:1001,title:'A note on reading',type:'Text',text:'Reading is not the same as believing. A source can state a figure plainly. Pin the passages that matter and the Draft keeps their source.',year:2026}]}})});
  await page.getByRole('heading',{name:'Your content',exact:true}).waitFor();
  const nav=page.getByRole('navigation',{name:'Workspace navigation'});
  assert.deepEqual((await nav.locator('.hd-primary button').allTextContents()).map(s=>s.replace(/\s/g,'')),['Overview','Ask','Draft']);
 assert.equal(await nav.getByText('Topics',{exact:true}).isVisible(),true,'Topics remains a first-class section');
 assert.equal(await nav.getByRole('button',{name:'Names',exact:false}).isVisible(),false);
 assert.equal(await page.getByText('When it happened',{exact:true}).isVisible(),false);
 assert.equal(await page.getByRole('button',{name:'Only this source',exact:true}).isVisible(),false);
 await page.locator('summary').filter({hasText:'Filter by time'}).click();
 await page.getByText('When it happened',{exact:true}).waitFor({state:'visible'});
 await page.locator('summary').filter({hasText:'Filter by time'}).click();
 await page.locator('summary').filter({hasText:'Source details & actions'}).click();
 await page.getByRole('button',{name:'Only this source',exact:true}).waitFor({state:'visible'});
 await page.locator('summary').filter({hasText:'Source details & actions'}).click();
await nav.locator('summary').filter({hasText:'Explore & manage'}).click();
  await nav.getByRole('button',{name:/^Names/}).click();
  await page.getByRole('heading',{name:'Names',exact:true}).waitFor();
  await nav.getByRole('button',{name:/^Overview/}).click();
  await page.locator('.hd-source-card').getByRole('button',{name:'A note on reading',exact:false}).first().click();
  await page.waitForFunction(()=>window.__app.state.view==='reader');
  await nav.getByRole('button',{name:/^Overview/}).click();
  await page.getByRole('heading',{name:'Your content',exact:true}).waitFor();
 // Missing evidence categories remain visible, and their excerpts are navigable.
 await page.locator('summary').filter({hasText:'No date of its own'}).click();
 await page.getByRole('button',{name:'Reading is not the same as believing.',exact:true}).click();
 assert.equal(await page.evaluate(()=>!!window.__app.state.sel),true);
 await page.evaluate(()=>{window.__app.setState({f:{},sel:null,view:'summary'});});
 await page.locator('summary').filter({hasText:'No date of its own'}).click();
 if(process.env.SCREENSHOT_DIR){fs.mkdirSync(process.env.SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'holodeck-desktop.png'),fullPage:true});}
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'mobile overflow');
await nav.getByRole('button',{name:'Ask',exact:true}).click();
  await page.waitForFunction(()=>window.__app.state.view==='ask');
  await nav.getByRole('button',{name:/^Overview/}).click();
 if(process.env.SCREENSHOT_DIR) await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'holodeck-mobile.png'),fullPage:true});
 // Active filters remain legible; mode controls and narrowing still work.
 await page.evaluate(()=>window.__app.setF('range',{mode:'happened',from:'2026',to:'2026',undated:true}));
 await page.locator('summary').filter({hasText:'Time filter · active'}).waitFor();
 assert.equal(await page.getByText('When it happened',{exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'Show everything',exact:true}).click();
 await page.getByRole('button',{name:'Table',exact:true}).click();
 assert.equal(await page.getByRole('table').count(),1);
 await page.getByRole('button',{name:'Cards',exact:true}).click();
 // Empty workspaces retain a working starting point.
 await page.evaluate(()=>window.__app.setState({added:{custom:[]},f:{},sel:null,view:'summary',just:null}));
 await page.getByRole('heading',{name:'What do you want to understand?',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'empty mobile overflow');
 assert.deepEqual(errors,[]);console.log('PASS: calm defaults, disclosures, navigation, source opening, gap witnesses, mobile width');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
