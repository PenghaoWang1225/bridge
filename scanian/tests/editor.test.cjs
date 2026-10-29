const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
let page=fs.readFileSync(path.join(root,'index.html'),'utf8');
function data(html,id){return html.match(new RegExp('<script id="'+id+'"[^>]*>([\\s\\S]*?)</script>'))[1];}
for(const [id,file] of Object.entries({biddingData:'records',partnerQuestions:'scanian',generalNotebookData:'scanian',originalBssLines:'source-bss'})){
 let value=JSON.parse(fs.readFileSync(path.join(root,'data',file+'.json'),'utf8'));
 if(id==='partnerQuestions')value=value.questions;
 if(id==='generalNotebookData')value=value.notebook;
 page=page.replace(new RegExp('(<script id="'+id+'"[^>]*>)[\\s\\S]*?(</script>)'),(_,a,b)=>a+JSON.stringify(value)+b);
}
page+='<script id="appScript">'+fs.readFileSync(path.join(root,'assets/app.js'),'utf8')+'</script>';
class TextNode{
  constructor(text){this.nodeType=3;this.nodeName='#text';this.nodeValue=String(text);this.parentElement=null;this.childNodes=[];}
  get textContent(){return this.nodeValue;}
}
class Element{
  constructor(tag='div'){
    this.nodeType=1;this.nodeName=tag.toUpperCase();this.childNodes=[];this.parentElement=null;this.dataset={};this.style={};this.value='';this.className='';this._html='';this.contentEditable='false';
    this.classList={contains:c=>this.className.split(' ').includes(c),add:c=>{if(!this.classList.contains(c))this.className+=' '+c;},remove:c=>{this.className=this.className.split(' ').filter(x=>x!==c).join(' ');},toggle:(c,on)=>{on??=!this.classList.contains(c);on?this.classList.add(c):this.classList.remove(c);return on;}};
  }
  get children(){return this.childNodes.filter(n=>n.nodeType===1);}
  get isConnected(){return !!this.rootConnected||!!this.parentElement?.isConnected;}
  clear(){for(const n of this.childNodes)n.parentElement=null;this.childNodes=[];this._html='';}
  append(...nodes){for(let n of nodes){if(typeof n==='string')n=new TextNode(n);n.parentElement=this;this.childNodes.push(n);}}
  set textContent(text){this.clear();if(String(text))this.append(String(text));}
  get textContent(){return this.childNodes.map(n=>n.textContent).join('');}
  set innerText(text){this.textContent=text;}
  get innerText(){return this.hiddenForTest?'':this.textContent;}
  set innerHTML(html){this.clear();this._html=String(html);}
  get innerHTML(){return this._html;}
  closest(selector){for(let n=this;n;n=n.parentElement)if(selector==='.desc'&&n.classList?.contains('desc'))return n;return null;}
  setAttribute(k,v){this[k]=v;}
  focus(){}
}
function walk(el){return [el,...el.children.flatMap(walk)];}
function boot({html=page,storage=new Map(),failWrite=false}={}){
  const body=new Element('body');body.rootConnected=true;const elements=new Map(),listeners={},downloads=[];
  for(const match of html.matchAll(/<([a-z]+)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
    const el=new Element(match[1]);el.id=match[2];el.className=match[0].match(/class="([^"]*)"/)?.[1]||'';
    const savedAt=match[0].match(/data-saved-at="([^"]*)"/)?.[1];if(savedAt)el.dataset.savedAt=savedAt;
    elements.set(el.id,el);body.append(el);
  }
  const get=id=>{assert(elements.has(id),'Unknown id '+id);return elements.get(id);};
  for(const id of ['biddingData','partnerQuestions','generalNotebookData','originalBssLines'])get(id).textContent=data(html,id);
  const all=selector=>walk(body).filter(el=>selector==='.desc'?el.classList.contains('desc'):selector==='.desc[contenteditable="true"]'?el.classList.contains('desc')&&el.contentEditable==='true':false);
  const document={body,getElementById:get,createElement:tag=>new Element(tag),querySelectorAll:all,addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn),documentElement:{get outerHTML(){let result=html;for(const id of ['biddingData','partnerQuestions','generalNotebookData','originalBssLines'])result=result.replace(new RegExp('(<script id="'+id+'"[^>]*>)[\\s\\S]*?(</script>)'),(_,a,b)=>{if(id==='partnerQuestions'){a=a.replace(/ data-saved-at="[^"]*"/,'');a=a.slice(0,-1)+' data-saved-at="'+get(id).dataset.savedAt+'">';}return a+get(id).textContent+b;});return result;}}};
  const ctx=vm.createContext({document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>{if(failWrite)throw Error('Storage full');storage.set(k,v);}},confirm:()=>true,alert:()=>{},setTimeout:()=>0,requestAnimationFrame:()=>0,navigator:{},console,structuredClone,window:{ScanianCloud:{changed:()=>{},save:()=>{}}},recordDownload:(...args)=>downloads.push(args)});
  const run=code=>vm.runInContext(code,ctx);run(data(html,'appScript'));run('dl=recordDownload;');
  return {run,get,all,storage,downloads,editable:id=>all('.desc').find(el=>Number(el.dataset.id)===id),dispatch:(type,target)=>{for(const fn of listeners[type]||[])fn({target,preventDefault(){}});}};
}

const editor=boot();const initial=editor.run('JSON.stringify(R)');
editor.get('editMode').onclick();for(const el of editor.all('.desc'))el.hiddenForTest=true;
editor.get('editMode').onclick();assert.equal(editor.run('JSON.stringify(R)'),initial);
editor.get('editMode').onclick();const el=editor.editable(222);editor.dispatch('focusin',el);el.textContent='Focused meaning';editor.dispatch('input',el);editor.get('editMode').onclick();
assert.equal(editor.run('window.ScanianApp.getState().meanings.find(m=>m.id===222).desc'),'Focused meaning');
const after=JSON.parse(editor.run('JSON.stringify(R)'));assert.deepEqual(after.filter(r=>r.id!==222),JSON.parse(initial).filter(r=>r.id!==222));
const beforeNote=editor.run('JSON.stringify(R)');editor.run('applyPartnerAnswerToTree(Q.find(q=>q.answer).id)');assert.equal(editor.run('JSON.stringify(R)'),beforeNote);
assert.equal(editor.storage.size,0,'Hosted editor must not use legacy browser caches');
console.log('PASS: Hosted editor preserves hidden meanings, changes only the used field, and appends partner answers as notes.');

const views=boot();
views.run("window.ScanianApp.setView('defense')");assert.equal(views.run('mode'),'they');
views.run("window.ScanianApp.setView('contested')");assert.equal(views.run('mode'),'we');assert.equal(views.run('uncontestedOnly'),false);
views.run("window.ScanianApp.setView('uncontested')");assert.equal(views.run('uncontestedOnly'),true);
assert.equal(views.run('JSON.stringify(R)'),initial,'Topic navigation must preserve the data');
console.log('PASS: All three section links select the intended tree view without changing content.');
