import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {REPO,DATA_PATH,clone,validate,equal,sameContent,mergeStates,resolveConflicts,encode,decode,saveRemote} from '../assets/state.mjs';
const root=new URL('../',import.meta.url);
const records=JSON.parse(fs.readFileSync(new URL('data/records.json',root),'utf8'));
const initial=JSON.parse(fs.readFileSync(new URL('data/scanian.json',root),'utf8'));
test('All 2278 meanings, five user edits, questions and rules survive migration',()=>{
  validate(initial,records);assert.equal(records.length,2278);
  for(const record of records)assert.equal(initial.meanings.find(m=>m.id===record.id).desc,record.desc);
  assert.equal(initial.meanings.filter(m=>!m.desc.trim()).length,18);
  assert.equal(initial.questions.length,3);assert.equal(initial.notebook.items.length,3);
  for(const id of [222,223,227,1395,2094])assert.notEqual(records[id].desc,records[id].sourceDesc);
});
test('Separate browser changes merge; same meaning conflicts; timestamps do not create false conflicts',()=>{
  const local=clone(initial),remote=clone(initial);
  local.meanings[2].desc='My edit';remote.meanings[3].desc='Other browser edit';
  let merged=mergeStates(initial,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.result.meanings[2].desc,'My edit');assert.equal(merged.result.meanings[3].desc,'Other browser edit');
  remote.meanings[2].desc='Conflicting edit';merged=mergeStates(initial,local,remote);assert.equal(merged.conflicts.length,1);
  const resolved=resolveConflicts(merged,new Map([['meanings:2','remote']]));assert.equal(resolved.meanings[2].desc,'Conflicting edit');assert.equal(resolved.meanings[3].desc,'Other browser edit');
  remote.meanings[2].desc='My edit';remote.meanings[2].meaningUpdatedAt='2099-01-01';assert.equal(mergeStates(initial,local,remote).conflicts.length,0);
});
test('Question deletions and rule edits merge without restoring deleted items',()=>{
  const local=clone(initial),remote=clone(initial),removed=local.questions.shift();remote.notebook.items[0].text='Remote rule';
  let merged=mergeStates(initial,local,remote);assert.equal(merged.conflicts.length,0);assert(!merged.result.questions.some(q=>q.id===removed.id));assert.equal(merged.result.notebook.items[0].text,'Remote rule');
  remote.questions[0].answer='Changed while deleted';merged=mergeStates(initial,local,remote);assert.equal(merged.conflicts.length,1);
});
test('Deliberate blank is retained; missing or duplicate auctions are rejected',()=>{
  const local=clone(initial);local.meanings[0].desc='';assert.equal(mergeStates(initial,local,initial).result.meanings[0].desc,'');
  const invalid=clone(initial);invalid.meanings.pop();assert.throws(()=>validate(invalid,records));
  invalid.meanings.push(invalid.meanings[0]);assert.throws(()=>validate(invalid,records));
});
test('Unicode and multiline text survives GitHub encoding',()=>{const text='♠♥♦♣ 反冲\nLast Train（最后一班车）';assert.equal(decode(encode(text)),text);});
test('Save retries stale SHA with a fresh merge and confirms a commit',async()=>{
  let current=clone(initial),version=1,puts=0;const local=clone(initial);local.meanings[1].desc='My update';
  const request=async(url,options={})=>{
    if(options.method!=='PUT')return {sha:String(version),encoding:'base64',content:encode(JSON.stringify(current))};
    puts++;const body=JSON.parse(options.body);assert.equal(body.sha,String(version));
    if(puts===1){current.meanings[2].desc='Concurrent update';version++;const e=new Error('stale');e.status=409;throw e;}
    current=JSON.parse(decode(body.content));return {commit:{sha:'confirmed'}};
  };
  const saved=await saveRemote(request,records,initial,local);assert.equal(saved.commit,'confirmed');assert.equal(puts,2);assert.equal(saved.state.meanings[2].desc,'Concurrent update');
});
test('Failed write is not reported as saved; conflicts never write',async()=>{
  const local=clone(initial);local.meanings[0].desc='Edit';let puts=0;
  const request=async(url,options={})=>{if(options.method==='PUT'){puts++;throw new Error('offline');}return {sha:'v1',encoding:'base64',content:encode(JSON.stringify(initial))};};
  await assert.rejects(saveRemote(request,records,initial,local),/offline/);assert.equal(puts,1);
  const remote=clone(initial);remote.meanings[0].desc='Other edit';puts=0;
  const result=await saveRemote(async(url,options={})=>{if(options.method==='PUT')puts++;return {sha:'v2',encoding:'base64',content:encode(JSON.stringify(remote))};},records,initial,local);
  assert.equal(result.conflict.conflicts.length,1);assert.equal(puts,0);
});
test('Unchanged state does not create a commit',async()=>{
  let puts=0;const result=await saveRemote(async(url,options={})=>{if(options.method==='PUT')puts++;return {sha:'v1',encoding:'base64',content:encode(JSON.stringify(initial))};},records,initial,initial);
  assert.equal(puts,0);assert(sameContent(result.state,initial));assert(equal(result.state,initial));
});

test('Project saves target only the bridge repository and nested data file',()=>{
  assert.equal(REPO,'bridge');
  assert.equal(DATA_PATH,'scanian/data/scanian.json');
});
