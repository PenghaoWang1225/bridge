import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as stateTools from '../assets/state.mjs';
const root=new URL('../',import.meta.url);
const source=fs.readFileSync(new URL('assets/github-save.mjs',root),'utf8').replace(/^import[^\n]*\n/,'').replace(/\nstart\(\);\s*$/,'');
const read=name=>JSON.parse(fs.readFileSync(new URL(`data/${name}.json`,root),'utf8'));
const records=read('records'),published=read('scanian'),bss=read('source-bss');
async function boot(search){
  const draft=structuredClone(published);draft.meanings[0].desc='Unpublished draft';
  const stored=JSON.stringify({base:published,local:draft});let reads=0,writes=0,requests=[];
  const elements=new Map(),classes=new Set(['reader','cloud-locked']);
  function element(id){if(!elements.has(id))elements.set(id,{dataset:{},textContent:'',value:'',classList:{add(){},remove(){}},addEventListener(){},focus(){},showModal(){},close(){}});return elements.get(id);}
  const window={location:{search},addEventListener(){}};
  const document={getElementById:element,addEventListener(){},createElement:()=>({}),body:{classList:{toggle(name,on){on?classes.add(name):classes.delete(name);}},append(script){
    window.ScanianApp={setView(){},finish(){},getState(){return {version:1,meanings:JSON.parse(element('biddingData').textContent).map(r=>({id:r.id,desc:r.desc,meaningUpdatedAt:r.meaningUpdatedAt})),questions:JSON.parse(element('partnerQuestions').textContent),notebook:JSON.parse(element('generalNotebookData').textContent)};}};
    script.onload();
  }}};
  const context=vm.createContext({...stateTools,document,window,URLSearchParams,AbortController,structuredClone,setTimeout,clearTimeout,localStorage:{getItem(){reads++;return stored;},setItem(){writes++;},removeItem(){writes++;}},fetch:async url=>{requests.push(url);const payload={'data/records.json':records,'data/scanian.json':published,'data/source-bss.json':bss}[url];assert(payload,'Unexpected request: '+url);return {ok:true,json:async()=>structuredClone(payload)};}});
  vm.runInContext(source,context);await vm.runInContext('start()',context);
  return {context,window,element,classes,requests,get reads(){return reads;},get writes(){return writes;},stored};
}

test('Public view shows published content and never reads, changes, or saves a browser draft',async()=>{
  const page=await boot('');
  assert(page.classes.has('reader'));assert.equal(page.reads,0);assert.equal(page.writes,0);
  assert.equal(page.window.ScanianApp.getState().meanings[0].desc,published.meanings[0].desc);
  assert.equal(page.element('readerStatus').textContent,'');
  await page.window.ScanianCloud.save();page.window.ScanianCloud.changed(true);
  assert.equal(page.writes,0);assert.equal(page.requests.length,3);
});

test('Editor mode restores the existing draft and requires a token before saving',async()=>{
  const page=await boot('?view=contested&edit=1');
  assert(!page.classes.has('reader'));assert(page.classes.has('cloud-locked'));
  assert.equal(page.reads,1);assert.equal(page.window.ScanianApp.getState().meanings[0].desc,'Unpublished draft');
  assert.match(page.element('cloudStatus').textContent,/draft restored/);
  await page.window.ScanianCloud.save();assert.equal(page.requests.length,3);
  assert.match(page.element('cloudStatus').textContent,/not saved to GitHub/);
});
