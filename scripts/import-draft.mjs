import fs from 'node:fs';
import path from 'node:path';
import {readEntries,compile} from './bidding.mjs';
const root=path.resolve(import.meta.dirname,'..');
const file=process.argv[2];if(!file)throw Error('Pass the JSON draft downloaded from the recovery page. Add --apply only after reviewing the preview.');
const draft=JSON.parse(fs.readFileSync(file,'utf8'));
if(!Array.isArray(draft.base?.meanings)||!Array.isArray(draft.local?.meanings))throw Error('Use the recovered draft containing both base and local data.');
const originals=JSON.parse(fs.readFileSync(path.join(root,'archive/pre-collection-records.json'),'utf8'));
const entries=readEntries(root),byLegacy=new Map(entries.map(e=>[e.data.source?.legacyId,e]));
const base=new Map(draft.base.meanings.map(m=>[m.id,m.desc]));
let changes=0,blanks=0;const conflicts=[];
for(const m of draft.local.meanings){
 const entry=byLegacy.get(m.id);if(!entry||typeof m.desc!=='string'||!base.has(m.id))throw Error(`Unknown or invalid auction ${m.id}.`);
 if(m.desc===base.get(m.id))continue;
 const current=entry.data.meaning??'';
 if(current!==base.get(m.id)&&current!==m.desc){conflicts.push(entry.data.auction);continue;}
 if(current===m.desc)continue;
 if(current.trim()&&!m.desc.trim())blanks++;
 entry.data.meaning=m.desc;if(m.meaningUpdatedAt)entry.data.meaningUpdatedAt=m.meaningUpdatedAt;changes++;
}
if(conflicts.length)throw Error(`Review conflicting meanings before import: ${conflicts.join(', ')}`);
if(blanks>=5)throw Error(`Import stopped: ${blanks} written meanings would become blank. Review the draft first.`);
compile(entries,originals);
const notebookPath=path.join(root,'content/notebook.json');
const notebook=JSON.parse(fs.readFileSync(notebookPath,'utf8'));
const canonical=id=>{if(typeof id==='string')return id;const hex=id.toString(16).padStart(15,'0');return `00000000-0000-4000-8${hex.slice(0,3)}-${hex.slice(3)}`;};
const before=new Map((draft.base.notebook?.items??[]).map(x=>[canonical(x.id),x.text]));
const mine=new Map((draft.local.notebook?.items??[]).map(x=>[canonical(x.id),x.text]));
const current=new Map((notebook.rules??[]).map(x=>[x.id,x.text]));let ruleChanges=0;
for(const id of new Set([...before.keys(),...mine.keys()])){
 if(mine.get(id)===before.get(id))continue;
 if(current.get(id)!==before.get(id)&&current.get(id)!==mine.get(id))throw Error('A general rule changed in both the old draft and the current notebook. Review it first.');
 if(current.get(id)!==mine.get(id)){ruleChanges++;mine.has(id)?current.set(id,mine.get(id)):current.delete(id);}
}
console.log(`Preview: ${changes} meaning changes and ${ruleChanges} rule changes. Old questions are not imported.`);
if(process.argv.includes('--apply')){
 const folder=path.join(root,'backups');fs.mkdirSync(folder,{recursive:true});const stamp=Date.now();
 fs.writeFileSync(path.join(folder,`before-draft-import-${stamp}.json`),JSON.stringify({entries:readEntries(root),notebook},null,2)+'\n');
 for(const e of entries)fs.writeFileSync(path.join(root,'content/bidding',e.file),JSON.stringify(e.data,null,2)+'\n');
 fs.writeFileSync(notebookPath,JSON.stringify({rules:[...current].map(([id,text])=>({id,text}))},null,2)+'\n');
 console.log('Imported locally. Run npm test and npm run build before committing and pushing.');
}
