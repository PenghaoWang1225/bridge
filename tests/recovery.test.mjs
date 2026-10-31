import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readEntries} from '../scripts/bidding.mjs';
const root=path.resolve(import.meta.dirname,'..');
const entries=readEntries(root);
const base={meanings:entries.filter(e=>e.data.source).map(e=>({id:e.data.source.legacyId,desc:e.data.meaning??''})),notebook:{items:JSON.parse(fs.readFileSync(path.join(root,'content/notebook.json'),'utf8')).rules??[]}};
function preview(draft){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-draft-'));try{const file=path.join(folder,'draft.json');fs.writeFileSync(file,JSON.stringify(draft));return spawnSync(process.execPath,[path.join(root,'scripts/import-draft.mjs'),file],{encoding:'utf8'});}finally{fs.rmSync(folder,{recursive:true});}}

test('Old drafts preview only changed meanings and leave source files unchanged',()=>{
 const draft={base:structuredClone(base),local:structuredClone(base)};draft.local.meanings[0].desc+=' Recovered edit';
 const result=preview(draft);assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/1 meaning changes/);assert.deepEqual(readEntries(root),entries);
});
test('Draft import stops on conflicting changes and large blank batches',()=>{
 const conflict={base:structuredClone(base),local:structuredClone(base)};conflict.base.meanings[0].desc='Earlier meaning';conflict.local.meanings[0].desc='Conflicting draft';
 assert.notEqual(preview(conflict).status,0);
 const blanks={base:structuredClone(base),local:structuredClone(base)};for(const m of blanks.local.meanings.filter(m=>m.desc.trim()).slice(0,6))m.desc='';
 const result=preview(blanks);assert.notEqual(result.status,0);assert.match(result.stderr,/6 written meanings would become blank/);assert.deepEqual(readEntries(root),entries);
});
