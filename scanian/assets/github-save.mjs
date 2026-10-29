import {OWNER,API,clone,validate,sameContent,mergeStates,resolveConflicts,readRemote,saveRemote} from './state.mjs';

const $=id=>document.getElementById(id);
const DRAFT='scanianWebsiteDraft:v1';
let token='',base,records,bss,app,busy=false,timer,conflict=null,storageFailed=false;
const status=(text,error=false)=>{$('cloudStatus').textContent=text;$('cloudStatus').dataset.error=error;};
const dirty=()=>app && !sameContent(base,app.getState());
function storeDraft(){
  try {if(dirty())localStorage.setItem(DRAFT,JSON.stringify({base,local:app.getState()}));else localStorage.removeItem(DRAFT);storageFailed=false;}
  catch {storageFailed=true;}
}
function draftStatus(){status(storageFailed?'Changes are not saved. Browser backup failed. Save to GitHub or download a backup.':'Draft kept in this browser. Click Finish editing or Save to GitHub.',storageFailed);}
async function request(url,options={}) {
  if(url!==API && !url.startsWith(API+'/') && url!=='https://api.github.com/user')throw new Error('Invalid GitHub request.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),30000);
  let response;
  try {response=await fetch(url,{...options,cache:'no-store',redirect:'error',signal:controller.signal,headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10',...(options.body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})}});}
  catch {throw new Error('The connection failed. Your draft is kept. Try Save to GitHub again.');}
  finally{clearTimeout(timeout);}
  if(!response.ok){const error=new Error(response.status===401?'GitHub rejected the token. Connect again.':response.status===403?'GitHub refused this request. Check token access, Contents permission, and API limits.':response.status===409?'The file changed during saving. Try again.':`GitHub returned error ${response.status}. Your draft is kept.`);error.status=response.status;throw error;}
  return response.json();
}
function lock(value){busy=value;document.body.classList.toggle('cloud-busy',value);$('cloudSave').disabled=value;$('disconnect').disabled=value;$('connect').disabled=value;}
function showConflicts(merged,remote){
  conflict={merged,remote};$('conflictList').replaceChildren();
  for(const item of merged.conflicts){
    const box=document.createElement('section');box.className='conflict-entry';
    const title=document.createElement('strong');title.textContent=item.collection==='meanings'?records.find(r=>r.id===item.id).pathPretty:`${item.collection}: ${item.id}`;box.append(title);
    for(const [choice,label] of [['local','Keep my draft'],['remote','Keep GitHub version']]){
      const row=document.createElement('label'),radio=document.createElement('input');radio.type='radio';radio.name=`${item.collection}:${item.id}`;radio.value=choice;radio.checked=choice==='local';row.append(radio,document.createTextNode(' '+label));box.append(row);
      const preview=document.createElement('pre'),value=item[choice];preview.textContent=value===undefined?'Deleted entry':value.desc??value.text??JSON.stringify(value,null,2);box.append(preview);
    }
    $('conflictList').append(box);
  }
  status('Changes also exist on GitHub. Review the conflicting entries before saving.',true);
  if(!$('conflictDialog').open)$('conflictDialog').showModal();
}
async function save(){
  clearTimeout(timer);
  if(!app || busy)return;
  app.finish();storeDraft();
  if(!token){if(dirty())status('Your draft is not saved to GitHub. Connect editing to save it.',true);return;}
  lock(true);status('Saving to GitHub…');
  try {
    const result=await saveRemote(request,records,base,app.getState());
    if(result.conflict){showConflicts(result.conflict,result.remote);return;}
    base=clone(result.state);app.setState(result.state);storeDraft();
    status('Saved to GitHub. The public page will update shortly.');
  } catch(error){storeDraft();status(error.message+(storageFailed?' Download a backup now.':''),true);}
  finally{lock(false);}
}
function changed(autosave){
  if(!app)return;
  storeDraft();if(!dirty())return;draftStatus();
  if(autosave){clearTimeout(timer);timer=setTimeout(save,350);}
}
window.ScanianCloud={changed,save};

// Only the connected owner can use the page's edit controls.
document.addEventListener('click',event=>{
  if(event.target.closest('[data-edit-control],.question-btn') && (!token||busy)){event.preventDefault();event.stopImmediatePropagation();}
},true);
document.addEventListener('beforeinput',event=>{if((!token||busy)&&event.target.closest('.desc'))event.preventDefault();},true);
window.addEventListener('beforeunload',event=>{if(dirty()){event.preventDefault();event.returnValue='';}});
$('connect').onclick=()=>{$('connectError').textContent='';$('connectDialog').showModal();$('githubToken').focus();};
$('cancelConnect').onclick=()=>{$('githubToken').value='';$('connectDialog').close();};
$('connectDialog').addEventListener('close',()=>{$('githubToken').value='';});
$('connectForm').onsubmit=async event=>{
  event.preventDefault();if(busy)return;lock(true);
  token=$('githubToken').value.trim();$('githubToken').value='';$('connectError').textContent='Checking your GitHub access…';
  try {
    const user=await request('https://api.github.com/user');
    if(user.login.toLowerCase()!==OWNER.toLowerCase())throw new Error(`Use the ${OWNER} account to edit this site.`);
    const repo=await request(API);
    if(!repo.permissions?.push)throw new Error('This account cannot save to this repository.');
    const remote=await readRemote(request,records);
    const merged=mergeStates(base,app.getState(),remote.state);
    document.body.classList.remove('cloud-locked');$('connect').classList.add('hidden');$('disconnect').classList.remove('hidden');$('connectDialog').close();
    if(merged.conflicts.length)showConflicts(merged,remote.state);
    else {base=clone(remote.state);app.setState(merged.result);storeDraft();status(dirty()?'Connected. Your restored draft is ready. Click Save to GitHub.':'Connected. You can edit meanings, rules, and questions.');}
  } catch(error){token='';$('connectError').textContent=error.message;}
  finally{lock(false);}
};
$('disconnect').onclick=()=>{clearTimeout(timer);app.finish();storeDraft();token='';document.body.classList.add('cloud-locked');$('connect').classList.remove('hidden');$('disconnect').classList.add('hidden');status(dirty()?'Disconnected. Unsaved changes remain in this browser. Download a backup or connect again.':'Disconnected. Your saved changes remain on GitHub.');};
$('cloudSave').onclick=save;
$('resolveConflicts').onclick=()=>{
  if(!conflict)return;
  const choices=new Map([...$('conflictList').querySelectorAll('input:checked')].map(x=>[x.name,x.value]));
  app.setState(resolveConflicts(conflict.merged,choices));base=clone(conflict.remote);conflict=null;storeDraft();$('conflictDialog').close();save();
};
$('cancelConflict').onclick=()=>{$('conflictDialog').close();status('The conflict is not resolved. Your draft is kept. Click Save to GitHub to review it again.',true);};
$('downloadBackup').onclick=()=>{app.finish();app.download('Scanian-backup.json',JSON.stringify(app.getState(),null,2),'application/json;charset=utf-8');};
$('saveHtml').onclick=async()=>{
  try {
    app.finish();const response=await fetch('assets/offline.html');if(!response.ok)throw new Error('The HTML template could not be loaded.');
    const doc=new DOMParser().parseFromString(await response.text(),'text/html'),state=app.getState();
    for(const [id,value] of Object.entries({biddingData:app.records(),partnerQuestions:state.questions,generalNotebookData:state.notebook,originalBssLines:bss}))doc.getElementById(id).textContent=JSON.stringify(value).replace(/<\/script/gi,'<\\/script');
    doc.getElementById('partnerQuestions').dataset.savedAt=new Date().toISOString();
    app.download('Scanian_v1_Bidding_Tree_with_Partner_Questions.html','<!doctype html>\n'+doc.documentElement.outerHTML,'text/html;charset=utf-8');
  }catch(error){status(error.message,true);}
};
$('importBackup').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||!token||busy)return;
  try {
    if(file.size>15000000)throw new Error('This file is too large. Choose a Scanian HTML or JSON backup.');
    app.finish();const text=await file.text();let imported;
    if(file.name.toLowerCase().endsWith('.html')){
      const doc=new DOMParser().parseFromString(text,'text/html');
      const read=id=>JSON.parse(doc.getElementById(id)?.textContent||'null');
      const rows=read('biddingData');
      if(!Array.isArray(rows)||rows.length!==records.length||rows.some((r,i)=>r.id!==records[i].id||r.bssPrefix!==records[i].bssPrefix))throw new Error('This HTML has a different bidding tree.');
      imported={version:1,updatedAt:new Date().toISOString(),meanings:rows.map(r=>({id:r.id,desc:r.desc,...(r.meaningUpdatedAt?{meaningUpdatedAt:r.meaningUpdatedAt}:{})})),questions:read('partnerQuestions'),notebook:read('generalNotebookData')};
    }else imported=JSON.parse(text);
    imported=validate(imported,records);
    const current=app.getState(),newBlanks=imported.meanings.filter(m=>!m.desc.trim()&&current.meanings.find(x=>x.id===m.id).desc.trim());
    if(newBlanks.length>=5)throw new Error(`Import stopped: ${newBlanks.length} written meanings would become blank. Use a repaired backup.`);
    if(!confirm('Replace the current draft with this backup? Review it before you save to GitHub.'))return;
    app.setState(imported);storeDraft();status('Backup imported as a draft. Review it, then click Save to GitHub.');
  }catch(error){status(error.message,true);}
};

async function start(){
  try {
    const [rows,state,source]=await Promise.all(['records','scanian','source-bss'].map(async name=>{const response=await fetch(`data/${name}.json`,{cache:'no-store'});if(!response.ok)throw new Error('The site data could not be loaded. Refresh to try again.');return response.json();}));
    records=rows;bss=source;base=validate(state,records);let initial=clone(base),restored=false;
    try {const draft=JSON.parse(localStorage.getItem(DRAFT)||'null');if(draft){base=validate(draft.base,records);initial=validate(draft.local,records);restored=true;}}catch{status('A browser draft could not be read. It has not been removed.',true);}
    const meanings=new Map(initial.meanings.map(m=>[m.id,m]));
    const activeRecords=records.map(r=>({...r,...meanings.get(r.id)}));
    for(const [id,value] of Object.entries({biddingData:activeRecords,partnerQuestions:initial.questions,generalNotebookData:initial.notebook,originalBssLines:bss}))$(id).textContent=JSON.stringify(value);
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='assets/app.js';script.onload=resolve;script.onerror=()=>reject(new Error('The tree could not be loaded. Refresh to try again.'));document.body.append(script);});
    app=window.ScanianApp;
    app.setView(new URLSearchParams(window.location.search).get('view'));
    status(restored?'Unsaved draft restored from this browser. Connect editing to save it to GitHub.':'Read mode. Connect editing to change this notebook.');
  }catch(error){status(error.message,true);$('connect').disabled=true;}
}
start();
