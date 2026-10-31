// One-time migration from the saved notebook. Normal builds never read old meanings.
import fs from 'node:fs';
import path from 'node:path';
import {legacyId,normalizeCall,filename,compile,sourceEntry} from './bidding.mjs';
const root=path.resolve(import.meta.dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,'archive',`pre-collection-${name}.json`),'utf8'));
const records=read('records'),saved=read('scanian');
const meanings=new Map(saved.meanings.map(m=>[m.id,m]));
const entries=records.map(r=>{
 const uncontested=!r.they&&r.tokens.every((t,i)=>i%2===0||t==='P');
 const section=r.they?'defense':uncontested?'uncontested':'contested';
 const m=meanings.get(r.id);if(!m)throw Error(`Missing saved meaning ${r.id}`);
 const calls=r.tokens.map(normalizeCall);
 const notes=saved.questions.filter(q=>q.recordId===r.id&&q.appliedToTree&&q.appliedAnswer).map(q=>q.appliedAnswer).join('\n\n');
 const data={id:legacyId(r.id),section,auction:(uncontested?calls.filter((_,i)=>i%2===0):calls).join('-'),meaning:m.desc,notes,artificial:r.artificial,forcing:r.disp,minLength:Number(r.minlen),maxLength:Number(r.maxlen),source:{legacyId:r.id,bssLine:r.line,bssPrefix:r.bssPrefix,originalMeaning:r.sourceDesc??r.desc??''},...(m.meaningUpdatedAt?{meaningUpdatedAt:m.meaningUpdatedAt}:{})};
 return {file:filename(data),data};
});
const nodes=compile(entries,records);
const folder=path.join(root,'content/bidding');
if(fs.readdirSync(folder).some(x=>x.endsWith('.json')))throw Error('Migration only runs into an empty bidding folder.');
for(const n of nodes)fs.writeFileSync(path.join(folder,n.file),JSON.stringify(sourceEntry(n),null,2)+'\n');
fs.writeFileSync(path.join(root,'content/notebook.json'),JSON.stringify({rules:saved.notebook.items},null,2)+'\n');
fs.writeFileSync(path.join(root,'content/site.json'),JSON.stringify({title:'Bridge',description:'My bridge systems, partnership agreements, and study notes.',systemTitle:'Scanian v1 Bidding Tree',sections:[{key:'uncontested',title:'Uncontested Bidding System',description:'Opening bids, responses, and agreements when the opponents pass.'},{key:'contested',title:'Contested',description:'Partnership agreements when the opponents enter the auction.'},{key:'defense',title:'Defense',description:'Responses to opponent openings and defensive agreements.'}]},null,2)+'\n');
console.log(`Migrated ${nodes.length} saved meanings and ${saved.notebook.items.length} rules. Questions remain in the archive only.`);
