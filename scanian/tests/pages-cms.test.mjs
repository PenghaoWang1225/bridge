import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {randomUUID} from 'node:crypto';
import {validate,noteId,mergeStates} from '../assets/state.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`,import.meta.url),'utf8'));
const records=read('records'),initial=read('scanian');

test('CMS omissions retain blank meanings, unanswered questions, and empty lists',()=>{
 const cms=structuredClone(initial);
 for(const meaning of cms.meanings)if(!meaning.desc)delete meaning.desc;
 for(const q of cms.questions){if(!q.answer)delete q.answer;if(!q.note)delete q.note;}
 const result=validate(cms,records);
 assert.deepEqual(result,initial);
 const empty=structuredClone(initial);delete empty.questions;delete empty.notebook.items;
 assert.deepEqual(validate(empty,records).questions,[]);
 assert.deepEqual(validate(empty,records).notebook.items,[]);
 const blank=structuredClone(initial);delete blank.meanings[0].desc;
 assert.equal(validate(blank,records).meanings[0].desc,'');
 assert.equal(initial.meanings.filter(m=>!m.desc).length,18);
});

test('Old numeric note IDs keep the same identity when a browser draft is restored',()=>{
 const old=structuredClone(initial);
 old.questions.forEach((q,i)=>q.id=[2,3,5][i]);old.notebook.items.forEach((r,i)=>r.id=i+1);
 const base=validate(old,records),draft=structuredClone(old),remote=structuredClone(initial);
 draft.questions[0].answer='Answer from the old draft';remote.meanings[4].desc='CMS edit';
 const merged=mergeStates(base,validate(draft,records),validate(remote,records));
 assert.equal(merged.conflicts.length,0);assert.equal(merged.result.questions.length,3);
 assert.equal(merged.result.questions.find(q=>q.id===noteId(2)).answer,'Answer from the old draft');
 assert.equal(merged.result.meanings[4].desc,'CMS edit');
 assert.equal(old.questions[0].id,2,'Validation must not mutate a backup');
});

test('New CMS IDs work; duplicate IDs and invalid auction links fail',()=>{
 const cms=structuredClone(initial);
 cms.questions.push({id:randomUUID(),recordId:1395,question:'A new question',status:'open'});
 cms.notebook.items.push({id:randomUUID(),text:'A new rule'});
 assert.equal(validate(cms,records).questions.at(-1).answer,'');
 const duplicate=structuredClone(cms);duplicate.questions.at(-1).id=duplicate.questions[0].id;
 assert.throws(()=>validate(duplicate,records),/ID is invalid/);
 cms.questions.at(-1).recordId=1.5;assert.throws(()=>validate(cms,records),/question is invalid/);
});

test('Partner notes stay separate from meanings; auction labels use source records',()=>{
 const cms=structuredClone(initial),q=cms.questions[0];
 Object.assign(q,{appliedToTree:true,appliedAnswer:'Agreed partner note',appliedAt:'2026-10-29'});
 cms.meanings[0].auction='Incorrect label';
 const checked=validate(cms,records);
 assert.equal(checked.questions[0].appliedAnswer,'Agreed partner note');
 assert.deepEqual(checked.meanings.map(m=>m.desc),initial.meanings.map(m=>m.desc));
 assert.equal(checked.meanings[0].auction,records[0].pathPretty);
});
