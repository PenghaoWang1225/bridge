// One-time import. Normal builds read the editable bidding JSON, not this snapshot.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { readEntries, compile, sourceEntry, filename, checkLegal } from './bidding.mjs';

const root = path.resolve(import.meta.dirname, '..');
const archive = path.join(root, 'archive/competitive-method-2026-10-31');
const source = JSON.parse(fs.readFileSync(path.join(archive, 'document.json'), 'utf8'));
const original = readEntries(root);
if (original.some(e => e.data.reference?.includes('Scanian Competitive Method')))
  throw Error('This document was already imported. Edit the source JSON through Pages CMS.');
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'archive/pre-collection-records.json'), 'utf8'));
const notebook = JSON.parse(fs.readFileSync(path.join(root, 'content/notebook.json'), 'utf8'));
const added = new Map();
const coverage = new Map();
const uuid = key => {
  const x = createHash('sha256').update(`scanian-competitive-2026-10-31:${key}`).digest('hex');
  return `${x.slice(0,8)}-${x.slice(8,12)}-4${x.slice(13,16)}-8${x.slice(17,20)}-${x.slice(20,32)}`;
};
function record(s, r, destination) {
  const key = `${s}:${r}`;
  if (!coverage.has(key)) coverage.set(key, new Set());
  coverage.get(key).add(destination);
}
function note(n, text) {
  if (text && !n.notes.includes(text)) n.notes += (n.notes ? '\n\n' : '') + text;
}
function context(auction, meaning, s) {
  let n = added.get(auction);
  if (!n) {
    n = { id: uuid(auction), section:'contested', auction, meaning, notes:'', artificial:false, forcing:'0', minLength:0, maxLength:8 };
    added.set(auction,n);
  }
  const ref = `Scanian Competitive Method — ${source.sections[s].heading}`;
  if (!n.reference?.includes(ref)) n.reference = n.reference ? `${n.reference}\n${ref}` : ref;
  return n;
}
function row(base,s,r,calls,options={}) {
  const src=source.sections[s].rows[r];
  for (const call of Array.isArray(calls) ? calls : [calls]) {
    const auction=`${base}-${call}`;
    checkLegal(auction.split('-'));
    const text=options.meaning ?? src.meaning;
    let n=added.get(auction);
    if (n && n.meaning !== text) {
      note(n, `The document also lists ${src.call}: ${src.meaning}`);
      note(n, `Other meaning in the same document: ${n.meaning}`);
      n.meaning='Needs discussion: the document lists more than one meaning for this bid.';
      n.needsDiscussion=true;
      n.forcing='0';
    } else n=context(auction,text,s);
    if (options.notes) note(n,options.notes);
    if (options.discuss) n.needsDiscussion=true;
    if (options.artificial !== undefined) n.artificial=options.artificial;
    if (options.forcing && !n.needsDiscussion) n.forcing=options.forcing;
    record(s,r,auction);
  }
}
function general(base,s,rows=source.sections[s].rows.map((_,i)=>i)) {
  const n=added.get(base);
  for (const r of rows) {
    const x=source.sections[s].rows[r];
    note(n,`${x.call}: ${x.meaning}`);
    record(s,r,base);
  }
}
function table(base,s,calls,overrides={}) {
  context(base,`Competitive agreements after ${source.sections[s].heading}.`,s);
  calls.forEach((c,r)=>row(base,s,r,c,overrides[r]??{}));
}
function rule(key,text,sourceRows=[]) {
  const id=uuid(`rule:${key}`);
  notebook.rules.push({id,section:'contested',text});
  for(const [s,r] of sourceRows) record(s,r,`rule:${id}`);
}

rule('overview','Competitive methods: responder uses transfers, switched bids, and bids that show a fit. After a double or redouble at the one-level, our third double, including redoubles, is for penalties.');
table('1C-X',0,['XX','1D','1H','1S','1NT','2C',['2D','2H'],'2S','2NT','3C']);
table('1D-X',1,['XX','1H','1S','1NT','2C',['2D','2H'],'2S','2NT','3C','3D']);
table('1C-1D',2,['X','1H','1S','1NT','2C',['2D','2H'],'2S','2NT','3C','3D']);
table('1C-1H',3,['X','1S','1NT','2C','2D','2H','2S','2NT','3C','3D']);
table('1D-1H',4,['X','1S','1NT','2C','2D','2H','2S','2NT','3C','3D']);
for(const m of ['C','D']) {
  const other=m==='C'?'D':'C';
  const b=`1${m}-1S`;
  context(b,'Opponents overcall 1♠ after our minor opening.',5);
  ['X','1NT',`2${other}`,[`2${m}`,`3${m}`],'2H','2S','2NT'].forEach((c,r)=>row(b,5,r,c));
  row(b,5,m==='D'?7:8,`3${other}`, m==='C'?{meaning:'10+, invitational or better; 5+ hearts and 5+ clubs.',notes:'Personal addition in the Google document. The document states that this agreement is not in the book.'}:{});
  const nt=`1${m}-1NT`;
  context(nt,'Opponents overcall a natural, strong 1NT after our minor opening.',6);
  ['X','2C','2D','2H','2S','2NT',`3${m}`].forEach((c,r)=>row(nt,6,r,c,r===2||r===3?{
    meaning:`Transfer; 5+ ${r===2?'hearts':'spades'}.`,
    discuss:true,notes:'Needs discussion: the document asks whether this should require a six-card suit.'
  }:{}));
}
table('1D-2C',7,['X',['2D','2H'],'2S','2NT','3C','3D'],{
  0:{meaning:'Either 5–10 with diamond support; a negative double with 4–4 in the majors; or a game-forcing hand.',discuss:true,notes:'Needs discussion: what should responder do with 8+ and only one major but no diamond support? The document gives 3–4–3–3 as an example and asks whether to pass, hoping opener reopens with a double.\nIf advancer passes: 2♦ is minimum; 3♦ shows 13–15 and long diamonds; other rebids show about 16+. The document asks whether 3M is a splinter.'}
});
row('1D-2C-X-P',7,0,'2D',{meaning:'Minimum. The next table gives 11–15.',notes:'The document also gives 3♦ as 13–15 with long diamonds. Other rebids show about 16+. The 3M splinter question is unresolved.'});
row('1D-2C-X-P',7,0,'3D',{meaning:'13–15; long diamonds.'});
context('1D-2C-X-3C','Advancer raises clubs after our double.',8);
row('1D-2C-X-3C',8,0,'X',{meaning:'Takeout; depends on strength and distribution.',notes:'If advancer passes: 3♦ is non-forcing with support; 3♥ shows 4–4 in the majors, non-forcing; 3♠ shows 4–4 in the majors, 11+ and game-forcing.'});
for(const [call,meaning] of [['3D','Non-forcing with diamond support.'],['3H','4–4 in the majors; non-forcing.'],['3S','4–4 in the majors; 11+ and game-forcing.']])
  row('1D-2C-X-3C-X-P',8,0,call,{meaning});
['2H','2S','2NT'].forEach((c,r)=>row('1D-2C-X-P-2D-P',9,r,c));
note(added.get('1D-2C-X-P-2D'),'Responder’s 2NT and all higher bids are game-forcing.');

// Expand a concrete relay continuation only where the document names the call.
row('1C-1D-1NT-P',2,3,'2D',{meaning:'Asks about the major-suit lengths.',artificial:true});
row('1C-1D-1NT-P-2D-P',2,3,'2H',{meaning:'May have only four hearts.'});
row('1C-1D-1NT-P-2D-P',2,3,'2S',{meaning:'Shows five spades.'});
note(added.get('1C-1D-1NT-P-2D'),'Higher replies show 4–4 in the majors and are game-forcing.');
row('1C-1D-3D-P',2,9,['3H','3S','4H','4S'],{meaning:'Pass or correct to responder’s major.'});
row('1C-1D-3D-P',2,9,'4C',{meaning:'Non-forcing.',forcing:'2'});

for(const m of ['C','D']) table(`1${m}-2${m}`,10,['X','2H','2S','2NT',['3H','3S']]);
for(const b of ['1C-2D','1C-2H','1C-2S','1D-2H','1D-2S']) {
  context(b,'Opponents make a natural jump overcall after our minor opening.',11);
  row(b,11,0,'X');
  for(const M of ['H','S']) if(checkBidAbove(`2${M}`,b.split('-').at(-1))) row(b,11,1,`2${M}`);
  // The transfer steps are not fully specified. Preserve the original general rules.
  row(b,11,4,'3S');
  general(b,11,[2,3,5]);
  note(added.get(b),'The source uses 3U for a transfer to the opponent’s suit. Confirm the exact transfer steps before adding these as separate auctions.');
}

for(const M of ['H','S']) {
  const b=`1${M}-X`;
  context(b,'Opponents double our major opening.',12);
  row(b,12,0,'XX',{meaning:'Not agreed.',discuss:true,notes:'The document questions the original redouble method and gives no replacement.'});
  if(M==='H') row(b,12,1,'1S',{meaning:'Not agreed.',discuss:true,notes:'The document questions the original 1♠ method and gives no replacement.'});
  row(b,12,2,'1NT'); row(b,12,3,'2C'); row(b,12,4,'2D');
  // 2U is retained as a rule because its overlap with the listed 2♦ meaning is unresolved.
  general(b,12,[5,9]);
  note(added.get(b),'Needs discussion: the source does not define 2U here. It also asks whether 3X should be preemptive or invitational.');
  added.get(b).needsDiscussion=true;
  row(b,12,6,`2${M}`); row(b,12,7,'2S'); row(b,12,8,'2NT');
  if(M==='H') {
    added.get(`${b}-2D`).needsDiscussion=true;
    note(added.get(`${b}-2D`),'Needs discussion: the table also lists 2U as a good major raise. If 2U means one step below 2M, it overlaps with this 2♦ meaning.');
  }
}
table('1H-1S',13,['X','1NT','2C','2D','2H','2S','2NT',['3C','3D'],'3H'],{
  8:{meaning:'Preemptive raise.',notes:'The Google document chooses a preemptive raise and notes that the book suggests a good raise.'}
});
for(const M of ['H','S']) {
  const b=`1${M}-1NT`;
  context(b,'Opponents overcall 1NT after our major opening.',14);
  row(b,14,0,'2C'); row(b,14,1,'2D');
  row(b,14,2,M==='H'?'2D':'2H',{meaning:M==='H'?'Competitive; five spades and two hearts.':'Competitive; five hearts and two spades.'});
  row(b,14,3,`2${M}`); row(b,14,4,'2NT'); row(b,14,5,['3C','3D']);
  table(`1${M}-2C`,15,['2D',M==='H'?'2S':'2H',`2${M}`,'2NT','3C']);
}
for(const b of ['1H-2D','1S-2D','1S-2H']) {
  context(b,'Opponents make a natural two-level overcall after our major opening.',16);
  row(b,16,0,'2NT'); row(b,16,1,`3${b.at(-1)}`);
}
table('1H-2S',17,['2NT','3S']);
rule('four-minor-two-suits','Four-level minor bids after a major opening: when the opponents show two specified suits, 4♣ is a slam try with shortness in their lower suit. 4♦ is a slam try with shortness in their higher suit.',[[18,0],[18,1]]);
rule('four-minor-one-suit','Four-level minor bids after a major opening: when only one opponent suit is known, including a natural three-level preempt, 4♣ is a good raise to game with control in their suit. A following 4♦ asks for extra values. 4♦ directly is a slam try without control. 4M is a natural raise; with opening strength, it denies control.',[[19,0],[19,1],[19,2]]);
rule('double-cue','When they double our cue-bid: Pass often denies control. Partner redoubles with the ace, or cue-bids with KQ or shortness. An immediate redouble shows the queen or better. An immediate cue-bid says that we can handle the situation.',[[20,0],[20,1],[20,2]]);
for(const M of ['H','S']) for(const interference of ['2NT','3C']) {
  const b=`1${M}-${interference}`;
  context(b,'Opponents show two specified suits. Use these agreements only for that meaning of the overcall.',21);
  row(b,21,0,'X'); general(b,21,[1,2,3]);
  note(added.get(b),'Here X and Y name their lower and higher suits. They do not mean double and redouble. The two shown suits must be known before choosing a cue-bid.');
  for(const [call,meaning,r] of [['4C','Slam try; shortness in their lower suit.',0],['4D','Slam try; shortness in their higher suit.',1]])
    row(b,18,r,call,{meaning:`If the overcall shows two specified suits: ${meaning}`});
}
for(const [M,s,cue] of [['H',22,'2S'],['S',23,'3H']]) {
  const b=`1${M}-2${M}`;
  context(b,`Michaels cue-bid: the other major and an unspecified minor.`,s);
  row(b,s,0,cue); row(b,s,1,'2NT');
  const their=M==='H'?'spade':'heart';
  row(b,s,2,'4C',{meaning:`Good raise to game with ${their} control.`});
  row(b,s,2,'4D',{meaning:`Slam try without ${their} control.`});
  row(b,s,3,`4${M}`);
}
for(const M of ['H','S']) for(const suit of ['C','D',M==='H'?'S':'H']) {
  const b=`1${M}-3${suit}`;
  const n=context(b,'Opponents make a natural three-level preempt after our major opening.',24);
  if(suit==='C') {
    n.meaning='Opponents bid 3♣. The agreements depend on whether this is natural or shows two specified suits.';
    note(n,'Natural preempt: use the natural-preempt meanings below. Two specified suits: use the two-suit meanings and the corresponding four-level minor rules.');
  }
  if(checkBidAbove(`3${M}`,`3${suit}`)) row(b,24,0,`3${M}`);
  else general(b,24,[0]);
  // 3M is not available after a higher preempt. Keep the condition explicit.
  if(!checkBidAbove(`3${M}`,`3${suit}`)) note(n,'The 3M raise applies only when 3M is still a legal bid.');
  for(const [r,call] of [[1,'4C'],[2,'4D'],[3,`4${M}`]]) {
    const text=`If the overcall is a natural preempt: ${source.sections[24].rows[r].meaning}`;
    const existing=added.get(`${b}-${call}`);
    if(existing) {
      existing.meaning += `\n${text}`;
      record(24,r,`${b}-${call}`);
    } else row(b,24,r,call,{meaning:text});
  }
  row(`${b}-4C-P`,19,0,'4D',{meaning:'Asks for extra values after the good raise to game.',notes:'Applies to the 4♣ raise when only one opponent suit is known.'});
}
for(const M of ['H','S']) table(`1${M}-4C`,25,['4D']);

function checkBidAbove(a,b) {
  const order=['C','D','H','S','NT'];
  return Number(a[0])*5+order.indexOf(a.slice(1)) > Number(b[0])*5+order.indexOf(b.slice(1));
}
for(let s=0;s<source.sections.length;s++) for(let r=0;r<source.sections[s].rows.length;r++)
  if(!coverage.has(`${s}:${r}`)) throw Error(`Source row ${s}:${r} has no destination.`);
for(const n of added.values()) {
  // Explicit source text is kept; unresolved alternatives do not acquire forcing tags.
  if(!n.needsDiscussion && /transfer/i.test(n.meaning)) {n.artificial=true;n.forcing='A';}
  if(!n.needsDiscussion && /\bGF\b|game.forcing/i.test(n.meaning) && !/almost|or|either/i.test(n.meaning)) n.forcing='6';
}
const merged=[...original,...[...added.values()].map(data=>({file:filename(data),data}))];
const nodes=compile(merged,baseline);
for(const n of nodes) {
  const target=path.join(root,'content/bidding',n.file);
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(sourceEntry(n),null,2)+'\n');
}
const expected=new Set(nodes.map(n=>n.file));
for(const e of original) if(!expected.has(e.file)) fs.unlinkSync(path.join(root,'content/bidding',e.file));
fs.writeFileSync(path.join(root,'content/notebook.json'),JSON.stringify(notebook,null,2)+'\n');
const report={documentUrl:'https://docs.google.com/document/d/1zryE84zbwZOYf80SetZnKc80y-GQNnGcyHR0LatK9pw/edit',sourceTables:source.sections.length,sourceRows:coverage.size,addedAuctions:added.size,retainedAuctions:original.length,discussionAuctions:[...added.values()].filter(n=>n.needsDiscussion).map(n=>n.auction),coverage:[...coverage].map(([key,targets])=>({sourceRow:key,targets:[...targets]}))};
fs.writeFileSync(path.join(archive,'import-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sourceTables:report.sourceTables,sourceRows:report.sourceRows,addedAuctions:report.addedAuctions,discussionAuctions:report.discussionAuctions},null,2));
