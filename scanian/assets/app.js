
const R=JSON.parse(document.getElementById('biddingData').textContent);
// Keep original BSS wording separate from manual edits; partner notes live with their questions.
for(const r of R){if(!Object.prototype.hasOwnProperty.call(r,'sourceDesc'))r.sourceDesc=r.desc||'';}
const DISP={"0": "No special agreement", "1": "To play", "2": "Non-forcing", "3": "Constructive", "4": "Invitational", "5": "Forcing", "6": "Game forcing", "7": "Slam try", "8": "Control bid", "9": "Preemptive", "A": "Transfer", "B": "Puppet", "C": "Relay", "D": "Asking bid", "E": "Asking response"};
const WE_COUNTS={"1C":521,"1D":222,"1H":385,"1S":151,"1N":329,"2C":91,"2D":117,"2H":55,"2S":18,"2N":277,"3N":5,"3C":2,"3D":2,"3H":2,"3S":2};
const THEY_COUNTS={"1C":60,"2D":12,"1D":9,"1S":12,"1H":6};
let mode='we'; let selected=null; let uncontestedOnly=true;
let questionsMode=false;
let Q=(()=>{try{return JSON.parse(document.getElementById('partnerQuestions').textContent)||[]}catch(e){return []}})();
const QUESTION_STORAGE_KEY='scanianPartnerQuestions::Scanian v1 (1).bss';

let activeQuestionId=null; let activeQuestionRecordId=null;

const MEANING_STORAGE_KEY='scanianMeaningEdits::Scanian v1 (1).bss';
function meaningKey(r){return r.bssPrefix||JSON.stringify([r.they,r.pos,r.vul,r.pathAscii]);}
// Keep the file baseline so an old browser edit cannot replace a new file meaning.
const embeddedMeanings=new Map(R.map(r=>[meaningKey(r),{desc:r.desc||'',updatedAt:r.meaningUpdatedAt||''}]));
const pendingMeaningEdits=new Map();
let activeMeaningElement=null;
const meaningRecovery={recovered:[],backupKey:null,saved:true};
function recoverBlankBatches(saved){
  const byKey=new Map(R.map(r=>[meaningKey(r),r]));
  const candidates=[...saved.values()].filter(item=>{
    const base=embeddedMeanings.get(item.key);
    return byKey.has(item.key)&&base?.desc.trim()&&!item.desc.trim()&&item.baseDesc.trim()&&item.inputVersion!==2;
  }).sort((a,b)=>Date.parse(a.updatedAt)-Date.parse(b.updatedAt));
  const batches=[];let group=[];
  for(const item of candidates){
    if(group.length&&Date.parse(item.updatedAt)-Date.parse(group[0].updatedAt)>1000){if(group.length>=5)batches.push(group);group=[];}
    group.push(item);
  }
  if(group.length>=5)batches.push(group);
  if(!batches.length)return;
  const rawBackup=JSON.stringify({version:1,items:[...saved.values()]});
  const backupKey=MEANING_STORAGE_KEY+'::before-blank-recovery::'+Date.now();
  const recoveredAt=new Date(Math.max(Date.now(),...batches.flat().map(item=>Math.max(Date.parse(item.updatedAt),Date.parse(embeddedMeanings.get(item.key).updatedAt)||0)+1))).toISOString();
  for(const batch of batches)for(const item of batch){
    const r=byKey.get(item.key),base=embeddedMeanings.get(item.key);
    meaningRecovery.recovered.push({recordId:r.id,auction:r.pathPretty,blankSavedAt:item.updatedAt,restoredText:base.desc});
    saved.set(item.key,{...item,desc:base.desc,baseDesc:base.desc,updatedAt:recoveredAt,inputVersion:2,recoveredFromBlankBatch:true});
  }
  try{
    // Keep the old saves before writing any recovered text.
    localStorage.setItem(backupKey,rawBackup);meaningRecovery.backupKey=backupKey;
    localStorage.setItem(MEANING_STORAGE_KEY,JSON.stringify({version:1,items:[...saved.values()]}));
  }catch(e){meaningRecovery.saved=false;}
}
function meaningAuditReport(){
  const blanks=R.filter(r=>!r.desc.trim());
  const review=blanks.filter(r=>(embeddedMeanings.get(meaningKey(r)).desc||r.sourceDesc||'').trim());
  return {
    checkedAuctions:R.length,
    recoveredBlankSaves:meaningRecovery.recovered,
    browserBackupKey:meaningRecovery.backupKey,
    recoveredSavesStored:meaningRecovery.saved,
    emptyMeaningsForReview:review.map(r=>({recordId:r.id,auction:r.pathPretty,savedAt:r.meaningUpdatedAt||null,fileMeaning:embeddedMeanings.get(meaningKey(r)).desc,sourceMeaning:r.sourceDesc||''})),
    emptySourceDescriptions:blanks.filter(r=>!review.includes(r)).map(r=>({recordId:r.id,auction:r.pathPretty})),
    changedMeanings:R.filter(r=>r.desc.trim()&&r.desc!==(r.sourceDesc||'')).map(r=>({recordId:r.id,auction:r.pathPretty,meaning:r.desc})),
    currentMeaningSaves:R.filter(r=>r.meaningUpdatedAt).map(r=>({recordId:r.id,auction:r.pathPretty,meaning:r.desc,savedAt:r.meaningUpdatedAt}))
  };
}
function renderMeaningAudit(){
  const report=meaningAuditReport(),recovered=report.recoveredBlankSaves.length,review=report.emptyMeaningsForReview;
  document.getElementById('meaningAuditSummary').textContent=`Checked ${report.checkedAuctions} auctions. Restored ${recovered} saved descriptions. Empty meanings to review: ${review.length}. Entries without a source description: ${report.emptySourceDescriptions.length}.`;
  const box=document.getElementById('meaningAuditReview');box.innerHTML='';
  for(const item of review){
    const row=document.createElement('p');
    const label=document.createElement('span');label.textContent=`${item.auction}: ${item.fileMeaning||item.sourceMeaning} `;
    const restore=document.createElement('button');restore.type='button';restore.dataset.editControl='';restore.className='btn';restore.dataset.editControl='';restore.textContent='Restore this text';
    restore.onclick=()=>{const r=byId.get(item.recordId);recordMeaningEdit(r,item.fileMeaning||item.sourceMeaning);persistMeaningEdits();renderMeaningAudit();renderContent();};
    row.append(label,restore);box.append(row);
  }
  if(recovered||review.length)document.getElementById('meaningAudit').open=true;
}

function meaningSaveStatus(text){document.getElementById('meaningSaveStatus').textContent=text;}
function readStoredMeaningEdits(){
  const raw=localStorage.getItem(MEANING_STORAGE_KEY);if(!raw)return new Map();
  let saved;try{saved=JSON.parse(raw);}catch(e){return new Map();}
  if(!saved||saved.version!==1||!Array.isArray(saved.items))return new Map();
  const valid=saved.items.filter(item=>item&&typeof item.key==='string'&&typeof item.desc==='string'&&typeof item.baseDesc==='string'&&Number.isFinite(Date.parse(item.updatedAt)));
  return new Map(valid.map(item=>[item.key,item]));
}
function loadMeaningEdits(){
  try{
    const saved=readStoredMeaningEdits();recoverBlankBatches(saved);let loaded=0;
    for(const r of R){
      const key=meaningKey(r),item=saved.get(key),base=embeddedMeanings.get(key);if(!item)continue;
      const embeddedTime=Date.parse(base.updatedAt)||0;
      if(Date.parse(item.updatedAt)<=embeddedTime)continue;
      if(!embeddedTime&&item.baseDesc!==base.desc)continue;
      r.desc=item.desc;r.meaningUpdatedAt=item.updatedAt;loaded++;
    }
    if(meaningRecovery.recovered.length)meaningSaveStatus(meaningRecovery.saved?'Recovered blank browser saves. Your written edits are kept. See Meaning check below.':'Recovered blank meanings in this page. Browser saving failed. Use Save edited HTML to keep the repair.');
    else if(loaded)meaningSaveStatus('Saved meanings loaded from this browser. Use Save edited HTML to keep a file copy.');
  }catch(e){meaningSaveStatus('Browser saving is unavailable. Use Save edited HTML to keep your changes.');}
}
function recordMeaningEdit(r,text){
  if(r.desc===text)return;
  r.desc=text;
  r.meaningUpdatedAt=new Date(Math.max(Date.now(),(Date.parse(r.meaningUpdatedAt)||0)+1)).toISOString();
  const key=meaningKey(r);
  pendingMeaningEdits.set(key,{key,desc:text,baseDesc:embeddedMeanings.get(key).desc,updatedAt:r.meaningUpdatedAt,inputVersion:2});
}
function persistMeaningEdits(){
  if(!pendingMeaningEdits.size)return;
  pendingMeaningEdits.clear();
  window.ScanianCloud?.changed(false);
  renderMeaningAudit();
}
// Read text without depending on whether a branch is open or visible.
function readMeaningText(el){
  function read(node){
    if(node.nodeType===3)return node.nodeValue;
    if(node.nodeName==='BR')return '\n';
    const text=Array.from(node.childNodes).map(read).join('');
    return node!==el&&/^(DIV|P|LI)$/.test(node.nodeName)?'\n'+text+'\n':text;
  }
  return read(el).replace(/\n{3,}/g,'\n\n').trim();
}
function captureMeaningElement(el){
  if(!el||!el.isConnected)return;
  const r=byId.get(Number(el.dataset.id));if(!r)return;
  const text=readMeaningText(el);
  if(text!==(r.desc||'').trim())recordMeaningEdit(r,text);
}
function captureMeaningEdits(){
  // Only save a field the user has used. Never scan closed branches.
  if(editOn)captureMeaningElement(activeMeaningElement);
  persistMeaningEdits();
}


const GENERAL_RULES_STORAGE_KEY='scanianGeneralRules::Scanian v1 (1).bss';
let generalNotebook=JSON.parse(document.getElementById('generalNotebookData').textContent);
let editingGeneralRuleId=null;
function renderGeneralRules(){
  const list=document.getElementById('generalRulesList');list.innerHTML='';
  if(!generalNotebook.items.length){
    const empty=document.createElement('li');empty.textContent='No general rules yet.';list.append(empty);
  }
  for(const rule of generalNotebook.items){
    const item=document.createElement('li');
    const text=document.createElement('div');text.className='general-rule-text';text.textContent=rule.text;
    const controls=document.createElement('div');controls.className='general-rule-controls';
    const edit=document.createElement('button');edit.type='button';edit.dataset.editControl='';edit.textContent='Edit';edit.dataset.editControl='';edit.onclick=()=>openGeneralRuleEditor(rule.id);
    const remove=document.createElement('button');remove.type='button';remove.dataset.editControl='';remove.textContent='Delete';remove.dataset.editControl='';remove.onclick=()=>{
      if(!confirm('Delete this general rule?'))return;
      generalNotebook.items=generalNotebook.items.filter(x=>x.id!==rule.id);
      if(editingGeneralRuleId===rule.id)closeGeneralRuleEditor();
      persistGeneralRules();renderGeneralRules();
    };
    controls.append(edit,remove);item.append(text,controls);list.append(item);
  }
}
function openGeneralRuleEditor(id=null){
  const rule=generalNotebook.items.find(x=>x.id===id);editingGeneralRuleId=rule?rule.id:null;
  document.getElementById('generalRuleText').value=rule?rule.text:'';
  document.getElementById('generalRuleLabel').textContent=rule?'Edit general rule':'New general rule';
  document.getElementById('saveGeneralRule').textContent=rule?'Save rule':'Add rule';
  document.getElementById('generalRuleForm').classList.remove('hidden');
  document.getElementById('generalRuleText').focus();
}
function closeGeneralRuleEditor(){
  editingGeneralRuleId=null;document.getElementById('generalRuleText').value='';
  document.getElementById('generalRuleForm').classList.add('hidden');
}
function persistGeneralRules(){
  generalNotebook.updatedAt=new Date().toISOString();
  window.ScanianCloud?.changed(true);
}
function saveGeneralRule(event){
  event.preventDefault();
  const text=document.getElementById('generalRuleText').value.trim();
  if(!text){document.getElementById('generalRuleText').focus();return;}
  const rule=generalNotebook.items.find(x=>x.id===editingGeneralRuleId);
  if(rule)rule.text=text;
  else generalNotebook.items.push({id:nextQuestionId(),text});
  persistGeneralRules();closeGeneralRuleEditor();renderGeneralRules();
}


const byId=new Map(R.map(r=>[r.id,r])); const kids=new Map();
for(const r of R){ if(r.parent!==null){ if(!kids.has(r.parent)) kids.set(r.parent,[]); kids.get(r.parent).push(r.id); } }
// Convert answers applied by older copies without overwriting later manual edits.
for(const q of Q){
  if(!q.appliedToTree||typeof q.appliedAnswer==='string')continue;
  const r=resolveQuestionRecord(q), answer=(q.answer||'').trim();
  if(!r||!answer)continue;
  if(r.desc===answer)r.desc=r.sourceDesc;
  q.appliedAnswer=answer;
}

renderMeaningAudit();
document.getElementById('downloadMeaningAudit').onclick=()=>{captureMeaningEdits();dl('Scanian_meaning_check.json',JSON.stringify(meaningAuditReport(),null,2),'application/json;charset=utf-8');};
function partnerNotesForRecord(id){return questionsForRecord(id).filter(q=>q.appliedToTree&&typeof q.appliedAnswer==='string'&&q.appliedAnswer.trim());}
function makePartnerNotes(r){
  const notes=partnerNotesForRecord(r.id);if(!notes.length)return null;
  const box=document.createElement('span');box.className='partner-notes';
  for(const q of notes){
    const note=document.createElement('span');note.className='partner-note';note.dataset.questionId=q.id;
    const label=document.createElement('strong');label.textContent='Partner note: ';
    const text=document.createElement('span');text.textContent=q.appliedAnswer;
    note.append(label,text);box.append(note);
  }
  return box;
}
function isUncontested(r){if(r.they)return true;for(let i=1;i<r.tokens.length;i+=2){if(r.tokens[i]!=='P')return false;}return true;}
function recordVisible(r){return !uncontestedOnly||r.they||isUncontested(r);}
function bdisp(t){ if(t==='P')return 'Pass';if(t==='D')return 'X';if(t==='R')return 'XX';const s={C:'♣',D:'♦',H:'♥',S:'♠',N:'NT'};return t[0]+s[t[1]];}
function normalize(s){return s.toUpperCase().replaceAll('♣','C').replaceAll('♦','D').replaceAll('♥','H').replaceAll('♠','S').replaceAll('NT','N').replace(/PASS/g,'P').replace(/[^0-9A-Z]+/g,'');}
function chips(r){let c=[];if(r.artificial)c.push(['Artificial','art']);if(r.disp&&DISP[r.disp])c.push([DISP[r.disp],r.disp==='6'?'gf':'']);if(r.minlen && /^[1-8]$/.test(r.minlen) && /^[1-7][CDHS]$/.test(r.last)){let suit=bdisp(r.last).slice(1);let txt=(r.maxlen==='8'?r.minlen+'+':r.minlen+'-'+r.maxlen)+suit;c.push([txt,'']);}if(Object.prototype.hasOwnProperty.call(r,'sourceDesc')&&(r.desc||'')!==(r.sourceDesc||''))c.push(['Edited meaning','partner']);if(partnerNotesForRecord(r.id).length)c.push(['Partner note','partner']);return c.map(x=>`<span class="chip ${x[1]}">${x[0]}</span>`).join('');}
function deltaLabel(r){ if(r.parent===null)return bdisp(r.last); const p=byId.get(r.parent); const d=r.tokens.slice(p.tokens.length); let hasOppNonPass=false; for(let i=0;i<d.length;i++){let global=p.tokens.length+i;let ours=r.they?(global%2===1):(global%2===0);if(!ours && d[i]!=='P')hasOppNonPass=true;} if(!hasOppNonPass && !['P','D','R'].includes(r.last))return bdisp(r.last); return d.map((t,i)=>{let global=p.tokens.length+i;let ours=r.they?(global%2===1):(global%2===0);let x=bdisp(t);return ours?x:`(${x})`;}).join(' – ');}
function questionsForRecord(id){return Q.filter(q=>resolveQuestionRecord(q)?.id===id);}
function qBadgeText(id){const n=questionsForRecord(id).length;return n?`Q${n}`:'+Q';}
function makeQuestionInline(r){const items=questionsForRecord(r.id);if(!items.length)return null;const box=document.createElement('div');box.className='question-inline';for(const q of items){const row=document.createElement('div');row.style.display='flex';row.style.gap='7px';row.style.alignItems='flex-start';row.style.width='100%';const tag=document.createElement('span');tag.className='qtag';tag.textContent=q.status==='answered'?'✓ Partner:':'? Partner:';const tx=document.createElement('span');tx.className='qtext';tx.textContent=q.question||'(empty question)';const eb=document.createElement('button');eb.type='button';eb.textContent='edit';eb.dataset.editControl='';eb.onclick=e=>{e.preventDefault();e.stopPropagation();openQuestionModal(r.id,q.id);};row.append(tag,tx,eb);box.append(row);}return box;}
function makeNode(id,depth=0){const r=byId.get(id), ch=(kids.get(id)||[]).filter(cid=>recordVisible(byId.get(cid)));const det=document.createElement('details');det.className='node'+(ch.length?'':' leaf');det.dataset.id=id; const sum=document.createElement('summary'); const bid=document.createElement('span');bid.className='bid '+(r.side==='them'?'opp':'');bid.textContent=deltaLabel(r); const ds=document.createElement('span');ds.className='desc';ds.dataset.id=r.id;ds.textContent=r.desc||(document.body.classList.contains('editing')?'':'(no description in source file)');if(document.body.classList.contains('editing'))ds.contentEditable='true';const cp=document.createElement('span');cp.className='chips';cp.innerHTML=chips(r);const qb=document.createElement('button');qb.type='button';qb.className='question-btn'+(questionsForRecord(r.id).length?' has-q':'');qb.textContent=qBadgeText(r.id);qb.title='Add a partner question linked to this exact auction';qb.onclick=e=>{e.preventDefault();e.stopPropagation();openQuestionModal(r.id,null);};const meaning=document.createElement('span');meaning.className='meaning';meaning.append(ds);const notes=makePartnerNotes(r);if(notes)meaning.append(notes);sum.append(bid,meaning,cp,qb);det.append(sum);const info=document.createElement('div');info.className='node-info';info.innerHTML=`<span class="path">Full auction:</span> ${r.pathPretty} &nbsp; <code>line ${r.line}</code>`;det.append(info);const qi=makeQuestionInline(r);if(qi)det.append(qi);for(const cid of ch)det.append(makeNode(cid,depth+1));return det;}
function rootsFor(open){let they=(mode==='they');let candidates=R.filter(r=>r.they===they && r.tokens[0]===open && recordVisible(r));if(mode==='we') return candidates.filter(r=>r.parent===null); // usually opening record
 // They-open: if a literal opening record exists, use it; otherwise use first-level calls as roots under synthetic heading.
 let exact=candidates.find(r=>r.tokens.length===1); if(exact)return [exact];
 return candidates.filter(r=>!candidates.some(p=>p.id!==r.id && r.tokens.length>p.tokens.length && r.tokens.slice(0,p.tokens.length).join('|')===p.tokens.join('|')));
}
function openingList(){const counts=mode==='we'?WE_COUNTS:THEY_COUNTS;return Object.keys(counts).sort((a,b)=>{let lv=x=>parseInt(x)||0;let o={C:0,D:1,H:2,S:3,N:4};return lv(a)-lv(b)||(o[a[1]]??9)-(o[b[1]]??9);});}
function renderSidebar(){const sb=document.getElementById('sidebar');sb.innerHTML='';for(const op of openingList()){const bt=document.createElement('button');bt.innerHTML=`<span>${mode==='they'?'Opp. ':''}${bdisp(op)}</span><small>${(mode==='we'?WE_COUNTS:THEY_COUNTS)[op]}</small>`;if(op===selected)bt.classList.add('active');bt.onclick=()=>{selected=op;renderSidebar();renderContent();};sb.append(bt);}}
function renderContent(){const q=document.getElementById('search').value.trim();const box=document.getElementById('content');box.innerHTML='';document.getElementById('questionsBtn').classList.toggle('active',questionsMode);if(questionsMode){renderQuestionsDashboard(box);return;}if(q){renderSearch(q);return;}if(!selected||!openingList().includes(selected))selected=openingList()[0];const sec=document.createElement('section');sec.className='tree-section';sec.innerHTML=`<h2>${mode==='they'?'Opponent ':''}${bdisp(selected)} ${mode==='they'?'— Defense / Competitive Actions':'Opening System'}</h2>`;if(mode==='they'&&!R.some(r=>r.they&&r.tokens[0]===selected&&r.tokens.length===1)){let p=document.createElement('p');p.style='font-size:13px;color:#667085';p.textContent='The source file does not define the meaning of this opponent opening itself; the actions defined for our side are listed below.';sec.append(p);}for(const root of rootsFor(selected))sec.append(makeNode(root.id));box.append(sec);}
function renderSearch(q){const box=document.getElementById('content'), nq=normalize(q);let arr=R.filter(r=>r.they===(mode==='they') && recordVisible(r));arr=arr.filter(r=>normalize(r.pathAscii).includes(nq)||normalize(r.pathCompact).includes(nq)||normalize(r.pathPretty).includes(nq)||normalize(r.desc).includes(nq)||partnerNotesForRecord(r.id).some(q=>normalize(q.appliedAnswer).includes(nq)));const sec=document.createElement('section');sec.className='search-results';sec.innerHTML=`<h2 style="margin-top:0;font-size:18px">Search results: ${arr.length}</h2>`;for(const r of arr.slice(0,300)){const d=document.createElement('div');d.className='result';const head=document.createElement('div');head.className='path';head.innerHTML=`${r.pathPretty} <span class="chips">${chips(r)}</span>`;const qb=document.createElement('button');qb.type='button';qb.className='question-btn'+(questionsForRecord(r.id).length?' has-q':'');qb.textContent=qBadgeText(r.id);qb.style.marginLeft='8px';qb.onclick=e=>{e.preventDefault();openQuestionModal(r.id,null);};head.append(qb);const desc=document.createElement('div');desc.className='desc';desc.dataset.id=r.id;desc.textContent=r.desc||(document.body.classList.contains('editing')?'':'(no description in source file)');if(document.body.classList.contains('editing'))desc.contentEditable='true';const small=document.createElement('small');small.textContent=`BSS line ${r.line}`;d.append(head,desc);const notes=makePartnerNotes(r);if(notes)d.append(notes);d.append(small);const qi=makeQuestionInline(r);if(qi)d.append(qi);sec.append(d);}if(arr.length>300){let p=document.createElement('p');p.textContent='More than 300 results. Please narrow your search.';sec.append(p);}box.append(sec);}

function resolveQuestionRecord(q){let r=byId.get(Number(q.recordId));if(r&&(!q.pathCompact||r.pathCompact===q.pathCompact))return r;if(q.pathCompact){r=R.find(x=>x.pathCompact===q.pathCompact);if(r){q.recordId=r.id;return r;}}return null;}
function nextQuestionId(){return Date.now()*1000+Math.floor(Math.random()*1000);}
function sourceSummary(r){if(!r)return 'Linked bid not found in this copy.';let parts=[];const sourceText=Object.prototype.hasOwnProperty.call(r,'sourceDesc')?r.sourceDesc:r.desc;parts.push(sourceText||'(no written description in source file)');let meta=[];if(r.artificial)meta.push('Artificial');if(r.disp&&DISP[r.disp])meta.push(DISP[r.disp]);if(r.minlen&&/^[1-8]$/.test(r.minlen)&&/^[1-7][CDHS]$/.test(r.last)){const suit=bdisp(r.last).slice(1);meta.push((r.maxlen==='8'?r.minlen+'+':r.minlen+'–'+r.maxlen)+suit);}return parts.join(' ') + (meta.length?`  [BSS metadata: ${meta.join(', ')}]`:'');}
function persistQuestions(){updateQuestionCount();window.ScanianCloud?.changed(true);}
function updateQuestionCount(){const el=document.getElementById('questionsCount');if(el)el.textContent=`(${Q.filter(q=>q.status!=='answered').length} open / ${Q.length})`;}
function openQuestionModal(recordId,qid){const r=byId.get(Number(recordId));activeQuestionRecordId=r?.id??Number(recordId);activeQuestionId=qid;const q=qid!=null?Q.find(x=>x.id===qid):null;document.getElementById('qModalTitle').textContent=q?'Edit partner question':'New partner question';document.getElementById('qModalPath').textContent=r?`Auction: ${r.pathPretty}`:'Auction not found';document.getElementById('qModalSource').textContent=r?`BSS says: ${sourceSummary(r)}`:'';document.getElementById('qText').value=q?.question||'';document.getElementById('qAnswer').value=q?.answer||'';document.getElementById('qStatus').value=q?.status||'open';document.getElementById('qDelete').style.display=q?'inline-block':'none';document.getElementById('questionModal').classList.remove('hidden');document.getElementById('questionModal').setAttribute('aria-hidden','false');setTimeout(()=>document.getElementById('qText').focus(),0);}
function closeQuestionModal(){document.getElementById('questionModal').classList.add('hidden');document.getElementById('questionModal').setAttribute('aria-hidden','true');activeQuestionId=null;activeQuestionRecordId=null;}
function saveQuestionModal(){const r=byId.get(Number(activeQuestionRecordId));const qt=document.getElementById('qText').value.trim();const ans=document.getElementById('qAnswer').value.trim();const st=document.getElementById('qStatus').value;if(!qt){alert('Please enter a question first.');return;}const now=new Date().toISOString();let q=activeQuestionId!=null?Q.find(x=>x.id===activeQuestionId):null;if(!q){q={id:nextQuestionId(),recordId:r?.id??activeQuestionRecordId,pathCompact:r?.pathCompact||'',question:'',answer:'',status:'open',note:'',createdAt:now,updatedAt:now};Q.push(q);}q.recordId=r?.id??q.recordId;q.pathCompact=r?.pathCompact||q.pathCompact;q.question=qt;q.answer=ans;q.status=st;q.updatedAt=now;persistQuestions();closeQuestionModal();renderContent();}
function applyPartnerAnswerToTree(qid){
  const q=Q.find(x=>x.id===qid);if(!q)return;
  const r=resolveQuestionRecord(q);if(!r){alert('The linked bidding-tree record could not be found.');return;}
  const ans=(q.answer||'').trim();if(!ans){alert("Record your partner's answer first.");return;}
  if(q.appliedToTree&&q.appliedAnswer===ans)return;
  q.appliedAnswer=ans;q.status='answered';q.appliedToTree=true;
  q.appliedAt=new Date().toISOString();q.updatedAt=q.appliedAt;
  persistQuestions();renderContent();
}
function removePartnerNote(qid){
  const q=Q.find(x=>x.id===qid);if(!q)return;
  q.appliedToTree=false;delete q.appliedAnswer;q.updatedAt=new Date().toISOString();
  persistQuestions();renderContent();
}
function restoreOriginalBssMeaning(qid){const q=Q.find(x=>x.id===qid);if(!q)return;const r=resolveQuestionRecord(q);if(!r)return;const original=Object.prototype.hasOwnProperty.call(r,'sourceDesc')?r.sourceDesc:'';if(!confirm(`Restore the original BSS wording for ${r.pathPretty}?`))return;recordMeaningEdit(r,original);persistMeaningEdits();q.updatedAt=new Date().toISOString();persistQuestions();renderContent();}
function deleteQuestionModal(){if(activeQuestionId==null)return;if(!confirm('Delete this partner question?'))return;Q=Q.filter(q=>q.id!==activeQuestionId);persistQuestions();closeQuestionModal();renderContent();}
function questionPlainText(q,index){const r=resolveQuestionRecord(q);let s=`${index}. ${r?r.pathPretty:q.pathCompact||'Unknown auction'}\n`;if(r)s+=`   BSS: ${sourceSummary(r)}\n`;s+=`   Question: ${q.question||''}\n`;if(q.answer)s+=`   Partner answer: ${q.answer}\n`;s+=`   Status: ${q.status==='answered'?'Answered':'Open'}`;return s;}
async function copyText(text){try{await navigator.clipboard.writeText(text);}catch(e){const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();document.execCommand('copy');ta.remove();}const t=document.getElementById('copyToast');t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1200);}
function copyAllQuestions(){const ordered=[...Q].sort((a,b)=>(a.status==='answered')-(b.status==='answered')||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));const text='Scanian — Questions for Partner\n\n'+ordered.map((q,i)=>questionPlainText(q,i+1)).join('\n\n');copyText(text);}
function downloadQuestions(){const ordered=[...Q].sort((a,b)=>(a.status==='answered')-(b.status==='answered')||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));const text='Scanian — Questions for Partner\n\n'+ordered.map((q,i)=>questionPlainText(q,i+1)).join('\n\n');dl('Scanian_questions_for_partner.txt',text,'text/plain;charset=utf-8');}
function jumpToRecord(id){const r=byId.get(Number(id));if(!r)return;questionsMode=false;mode=r.they?'they':'we';selected=r.tokens[0];document.getElementById('search').value='';document.getElementById('tabWe').classList.toggle('active',mode==='we');document.getElementById('tabThey').classList.toggle('active',mode==='they');renderSidebar();renderContent();requestAnimationFrame(()=>{const node=document.querySelector(`details.node[data-id="${r.id}"]`);if(!node)return;let p=node.parentElement?.closest('details.node');while(p){p.open=true;p=p.parentElement?.closest('details.node');}node.open=true;node.classList.add('q-highlight');node.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>node.classList.remove('q-highlight'),2600);});}
function renderQuestionsDashboard(box){const sec=document.createElement('section');sec.className='questions-dashboard';sec.innerHTML='<h2>Questions for Partner</h2><p class="lead">Every question is linked to the exact bidding-tree record. Record your partner’s answer, then append it as a note below the bidding explanation. Each question has its own note; updating a note preserves the explanation.</p>';const actions=document.createElement('div');actions.className='q-actions';const back=document.createElement('button');back.className='btn';back.textContent='← Back to bidding tree';back.onclick=()=>{questionsMode=false;renderContent();};const copy=document.createElement('button');copy.className='btn';copy.textContent='Copy all questions';copy.onclick=copyAllQuestions;const down=document.createElement('button');down.className='btn';down.textContent='Download question list';down.onclick=downloadQuestions;actions.append(back,copy,down);sec.append(actions);const ordered=[...Q].sort((a,b)=>(a.status==='answered')-(b.status==='answered')||String(a.id).localeCompare(String(b.id),undefined,{numeric:true}));if(!ordered.length){const p=document.createElement('p');p.textContent='No questions yet. Return to the tree and click +Q beside any bid.';sec.append(p);}for(const q of ordered){const r=resolveQuestionRecord(q);const card=document.createElement('div');card.className='q-card'+(q.status==='answered'?' answered':'');const path=document.createElement('div');path.className='q-path';path.textContent=r?r.pathPretty:(q.pathCompact||'Linked bid not found');const st=document.createElement('span');st.className='q-status'+(q.status==='answered'?' answered':'');st.textContent=q.status==='answered'?'Answered':'Open';path.append(st);const source=document.createElement('div');source.className='q-source';source.textContent=r?`Original BSS: ${sourceSummary(r)}`:'Linked BSS record not found in this file.';const qt=document.createElement('div');qt.className='q-question';qt.textContent=q.question||'(empty question)';const ans=document.createElement('div');ans.className='q-answer'+(q.answer?'':' empty');ans.textContent=q.answer?`Partner answer: ${q.answer}`:'Partner answer: not recorded yet';card.append(path,source,qt,ans);if(q.appliedToTree&&q.appliedAnswer){const note=document.createElement('div');note.className='q-answer';note.textContent=`Note in tree: ${q.appliedAnswer}`;card.append(note);}if(r&&Object.prototype.hasOwnProperty.call(r,'sourceDesc')&&(r.desc||'')!==(r.sourceDesc||'')){const tree=document.createElement('div');tree.className='q-answer';tree.textContent=`Current tree meaning: ${r.desc||'(blank)'}`;card.append(tree);}const controls=document.createElement('div');controls.className='q-controls';const edit=document.createElement('button');edit.dataset.editControl='';edit.textContent='Edit / answer';edit.onclick=()=>openQuestionModal(r?.id??q.recordId,q.id);const cp=document.createElement('button');cp.textContent='Copy';cp.onclick=()=>copyText(questionPlainText(q,1).replace(/^1\. /,''));const apply=document.createElement('button');const answer=(q.answer||'').trim();const noteIsCurrent=q.appliedToTree&&q.appliedAnswer===answer;apply.dataset.editControl='';apply.textContent=noteIsCurrent?'Note added ✓':q.appliedToTree?'Update partner note':'Append partner answer as note';apply.disabled=!r||!answer||noteIsCurrent;apply.onclick=()=>applyPartnerAnswerToTree(q.id);const remove=document.createElement('button');remove.dataset.editControl='';remove.textContent='Remove partner note';remove.onclick=()=>removePartnerNote(q.id);const restore=document.createElement('button');restore.dataset.editControl='';restore.textContent='Restore original BSS meaning';restore.disabled=!r||!Object.prototype.hasOwnProperty.call(r,'sourceDesc')||(r.desc||'')===(r.sourceDesc||'');restore.onclick=()=>restoreOriginalBssMeaning(q.id);const jump=document.createElement('button');jump.textContent='Jump to bid';jump.disabled=!r;jump.onclick=()=>r&&jumpToRecord(r.id);controls.append(edit,cp,apply);if(q.appliedToTree&&q.appliedAnswer)controls.append(remove);if(!restore.disabled)controls.append(restore);controls.append(jump);card.append(controls);sec.append(card);}box.append(sec);}

function setMode(m){questionsMode=false;mode=m;selected=null;document.getElementById('tabWe').classList.toggle('active',m==='we');document.getElementById('tabThey').classList.toggle('active',m==='they');renderSidebar();selected=openingList()[0];renderSidebar();renderContent();}
document.getElementById('tabWe').onclick=()=>setMode('we');document.getElementById('tabThey').onclick=()=>setMode('they');document.getElementById('uncontested').onclick=()=>{uncontestedOnly=!uncontestedOnly;document.getElementById('uncontested').classList.toggle('active',uncontestedOnly);renderContent();};document.getElementById('questionsBtn').onclick=()=>{questionsMode=!questionsMode;renderContent();};document.getElementById('search').oninput=()=>{questionsMode=false;renderContent();};document.getElementById('collapse').onclick=()=>document.querySelectorAll('details[open]').forEach(x=>x.open=false);
let editOn=false;
function applyEditState(){document.body.classList.toggle('editing',editOn);document.getElementById('editMode').classList.toggle('edit-on',editOn);document.getElementById('editMode').textContent=editOn?'Finish editing':'Edit meanings';document.querySelectorAll('.desc').forEach(x=>{const r=byId.get(Number(x.dataset.id));x.contentEditable=editOn?'true':'false';if(r)x.textContent=r.desc||(editOn?'':'(no description in source file)');});}
document.getElementById('editMode').onclick=()=>{captureMeaningEdits();editOn=!editOn;if(!editOn)activeMeaningElement=null;applyEditState();if(!editOn)window.ScanianCloud?.save();};
document.addEventListener('focusin',e=>{if(!editOn)return;const el=e.target.closest?.('.desc');if(el)activeMeaningElement=el;});
document.addEventListener('focusout',e=>{if(!editOn)return;const el=e.target.closest?.('.desc');if(!el)return;captureMeaningElement(el);persistMeaningEdits();});
document.addEventListener('input',e=>{if(!editOn)return;const el=e.target.closest?.('.desc');if(!el)return;activeMeaningElement=el;captureMeaningElement(el);persistMeaningEdits();});
function dl(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type||'text/plain;charset=utf-8'}));a.download=name;document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);}
function safeDataScriptJson(obj){return JSON.stringify(obj).replace(/<\/script/gi,'<\\/script');}
function toBssDesc(s){return (s||'').replaceAll('♣','!C').replaceAll('♦','!D').replaceAll('♥','!H').replaceAll('♠','!S');}
document.getElementById('saveBss').onclick=()=>{captureMeaningEdits();const lines=JSON.parse(document.getElementById('originalBssLines').textContent);for(const r of R){if(r.bssPrefix&&r.line>0&&r.line<=lines.length)lines[r.line-1]=r.bssPrefix+toBssDesc(r.desc);}dl('Scanian_v1_edited.bss',lines.join('\r\n'),'text/plain;charset=us-ascii');};
document.getElementById('addGeneralRule').onclick=()=>openGeneralRuleEditor();
document.getElementById('cancelGeneralRule').onclick=closeGeneralRuleEditor;
document.getElementById('generalRuleForm').onsubmit=saveGeneralRule;
renderGeneralRules();
document.getElementById('qCancel').onclick=closeQuestionModal;
document.getElementById('qSave').onclick=saveQuestionModal;
document.getElementById('qDelete').onclick=deleteQuestionModal;
document.getElementById('qCopy').onclick=()=>{const r=byId.get(Number(activeQuestionRecordId));const temp={question:document.getElementById('qText').value.trim(),answer:document.getElementById('qAnswer').value.trim(),status:document.getElementById('qStatus').value,pathCompact:r?.pathCompact||''};copyText(questionPlainText(temp,1).replace(/^1\. /,''));};
document.getElementById('questionModal').onclick=e=>{if(e.target.id==='questionModal')closeQuestionModal();};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('questionModal').classList.contains('hidden'))closeQuestionModal();});
persistQuestions();
setMode('we');applyEditState();

window.ScanianApp={
  setView(view){
    if(!['uncontested','contested','defense'].includes(view))return;
    uncontestedOnly=view==='uncontested';
    document.getElementById('uncontested').classList.toggle('active',uncontestedOnly);
    setMode(view==='defense'?'they':'we');
  },
  getState(){return {version:1,updatedAt:new Date().toISOString(),meanings:R.map(r=>({id:r.id,desc:r.desc,auction:r.pathPretty,...(r.meaningUpdatedAt?{meaningUpdatedAt:r.meaningUpdatedAt}:{})})),questions:structuredClone(Q),notebook:structuredClone(generalNotebook)};},
  setState(state){
    for(const m of state.meanings){const r=byId.get(m.id);r.desc=m.desc;if(m.meaningUpdatedAt)r.meaningUpdatedAt=m.meaningUpdatedAt;else delete r.meaningUpdatedAt;}
    Q=structuredClone(state.questions);generalNotebook=structuredClone(state.notebook);activeMeaningElement=null;
    renderGeneralRules();updateQuestionCount();renderMeaningAudit();renderContent();applyEditState();
  },
  finish(){captureMeaningEdits();editOn=false;activeMeaningElement=null;applyEditState();},
  records(){return structuredClone(R);},
  download:dl
};
