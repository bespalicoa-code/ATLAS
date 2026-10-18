/* ATLAS · Asistent AI (modul adăugat)
   Se încarcă DUPĂ scriptul principal: <script src="atlas-ai.js"></script> înainte de </body>.
   - Analiza locală funcționează fără internet și fără cheie.
   - Funcțiile AI (observații, întrebări, chat) folosesc cheia API a profesorului, păstrată doar în acest browser.
   - Către AI se trimit DOAR date anonimizate (Elev 1, Elev 2...), niciodată numele elevilor. */
(()=>{
'use strict';
const KEY='atlas-ai-v1',QKEY='atlas-ai-questions-v1';
let S=Object.assign({key:'',model:'claude-sonnet-5-5',notes:false},readLocal(KEY,{}));
let genQs=[];
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
const valid=q=>q&&typeof q.q==='string'&&q.q.trim()&&Array.isArray(q.a)&&q.a.length===4&&q.a.every(x=>typeof x==='string')&&Number.isInteger(q.c)&&q.c>=0&&q.c<4;
const clean=q=>({q:q.q.trim().slice(0,300),a:q.a.map(x=>x.trim().slice(0,150)),c:q.c,info:String(q.info||'').slice(0,300)});
const savedQs=(()=>{const a=readLocal(QKEY,[]);return Array.isArray(a)?a.filter(valid).map(clean):[]})();
const saveQs=()=>{try{localStorage.setItem(QKEY,JSON.stringify(savedQs))}catch(e){}};
savedQs.forEach(q=>geoQuestions.push(q));
const rich=t=>escapeHtml(t).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>');
const deanon=t=>{const st=cls().students;return String(t).replace(/Elev(?:ul)? (\d+)/g,(m,n)=>st[n-1]?st[n-1].name:m)};

// ---------- Apel către Claude ----------
async function ask(system,user,maxTokens=1200){
  if(!S.key)throw new Error('nokey');
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':S.key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:S.model,max_tokens:maxTokens,system,messages:[{role:'user',content:user}]})});
  if(!r.ok){let m='';try{m=(await r.json()).error.message}catch(e){}throw new Error(m||('HTTP '+r.status))}
  const d=await r.json();return (d.content||[]).map(b=>b.text||'').join('').trim()}
async function run(btn,fn){const old=btn.textContent;btn.disabled=true;btn.textContent='Se generează…';
  try{await fn()}catch(e){showToast(e.message==='nokey'?'Adaugă mai întâi cheia API în secțiunea „Conexiune AI”.':e.message==='Failed to fetch'?'Nu m-am putut conecta la serviciul AI. Verifică internetul.':'Eroare AI: '+e.message,true)}
  finally{btn.disabled=false;btn.textContent=old}}

// Context anonimizat al clasei
function ctx(){const c=cls(),t=totals();
  const lines=c.students.map((s,i)=>`Elev ${i+1}: ${t.sum.get(s.id)||0} puncte, nota ${gradeFor(s.id)}, ${t.cnt.get(s.id)||0} înregistrări`+(S.notes?`; motive: ${c.logs.filter(x=>x.sid===s.id).map(x=>x.note).filter(Boolean).slice(0,8).join(' | ')}`:''));
  return `Clasa ${c.name}. Maximul clasei: ${t.max} puncte. Nota = puncte / maxim × 10.\n`+lines.join('\n')}

// ---------- Analiză locală (fără AI, fără internet) ----------
function localInsights(){
  const c=cls(),t=totals(),max=t.max,n=c.students.length;
  const rows=c.students.map(s=>({name:s.name,total:t.sum.get(s.id)||0,cnt:t.cnt.get(s.id)||0,grade:gradeFor(s.id)}));
  const out=[];
  if(max<=0)return ['Încă nu există puncte înregistrate. Analiza apare după primele punctaje.'];
  const none=rows.filter(r=>r.total===0),low=rows.filter(r=>r.total>0&&r.total*100/max<40),top=[...rows].sort((a,b)=>b.total-a.total).slice(0,3);
  const ev=rows.filter(r=>r.total>0),avg=ev.length?ev.reduce((s,r)=>s+r.grade,0)/ev.length:0;
  out.push(`**Imagine generală:** ${ev.length} din ${n} elevi au puncte; nota medie a elevilor evaluați este **${fmt(avg)}**.`);
  out.push(`**În frunte:** ${top.map(r=>`${r.name} (${fmt(r.total)} pct.)`).join(', ')}.`);
  if(none.length)out.push(`**Fără puncte (${none.length}):** ${none.slice(0,12).map(r=>r.name).join(', ')}${none.length>12?'…':''}. Merită să fie implicați la lecția următoare.`);
  if(low.length)out.push(`**Sub 40% din maxim (${low.length}):** ${low.slice(0,12).map(r=>r.name).join(', ')}${low.length>12?'…':''}. Ar putea avea nevoie de sprijin sau de o a doua șansă.`);
  const DAY=864e5,now=Date.now(),w1=c.logs.filter(x=>now-x.ts<7*DAY).reduce((s,x)=>s+x.points,0),w0=c.logs.filter(x=>now-x.ts>=7*DAY&&now-x.ts<14*DAY).reduce((s,x)=>s+x.points,0);
  if(w1||w0)out.push(`**Ritm:** ${fmt(w1)} puncte în ultimele 7 zile față de ${fmt(w0)} în săptămâna dinainte${w1>w0?' — activitatea crește.':w1<w0?' — activitatea scade.':'.'}`);
  const solo=rows.filter(r=>r.cnt===1).length;if(solo>=3)out.push(`**Notă:** ${solo} elevi au o singură înregistrare; notele lor se bazează pe puțină activitate.`);
  const spread=ev.length>1?Math.max(...ev.map(r=>r.total))-Math.min(...ev.map(r=>r.total)):0;if(spread>max*.6)out.push('**Diferențe mari** între elevi: un test scurt de recapitulare ar putea echilibra clasa.');
  return out}
function localRemark(sid){
  const t=totals(),max=t.max,tot=totalFor(sid),cnt=countFor(sid),g=gradeFor(sid),pct=max>0?Math.round(tot*100/max):0;
  if(tot===0)return 'Nu are încă puncte înregistrate la geografie. Îl/o încurajez să participe mai activ la lecții și să se implice în teme.';
  if(pct>=80)return `Rezultate foarte bune la geografie (nota ${g}), cu ${cnt} ${pl(cnt,'intervenție','intervenții')} valorificate. Participă constant și este un exemplu pentru clasă.`;
  if(pct>=50)return `Activitate bună la geografie (nota ${g}). Are potențial pentru rezultate și mai bune dacă participă mai des la lecții.`;
  return `Activitate modestă până acum (nota ${g}). Recomand mai multă implicare la lecții și rezolvarea regulată a temelor; progresul este posibil.`}

// ---------- Interfața ----------
const css=document.createElement('style');
css.textContent=`.ai-body{padding:18px 19px}.ai-row{display:flex;gap:9px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px}.ai-row .form-row{margin:0;flex:1;min-width:150px}.ai-out{margin-top:12px;padding:14px 16px;border-radius:12px;background:var(--bg);border:1px solid var(--line);line-height:1.6;font-size:13px}.ai-out ul{margin:0;padding-left:18px}.ai-out li{margin:6px 0}.ai-out.hidden{display:none}.ai-out textarea{width:100%;min-height:90px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--white);color:var(--ink)}.ai-badge{display:inline-flex;align-items:center;gap:6px;font-size:10px;font-weight:850;padding:4px 9px;border-radius:99px;background:#efedfc;color:#5a4fb8;letter-spacing:.04em}.ai-q{padding:11px 0;border-bottom:1px solid var(--line);display:flex;gap:10px;align-items:flex-start}.ai-q:last-child{border:0}.ai-q input{margin-top:4px}.ai-q small{display:block;color:var(--muted);margin-top:4px}.ai-note{font-size:11px;color:var(--muted);line-height:1.55;margin:8px 0 0}.ai-key{display:flex;gap:9px;flex-wrap:wrap}.ai-key input[type=password],.ai-key select{flex:1;min-width:180px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--white);color:var(--ink)}.ai-check{display:flex;gap:8px;align-items:center;margin-top:10px;font-size:12px}.ai-ok{color:#16856c;font-weight:750}`;
document.head.appendChild(css);

const navBtn=document.createElement('button');navBtn.dataset.page='ai';
navBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>Asistent AI';
document.querySelector('.nav [data-page="quiz"]').after(navBtn);
navBtn.addEventListener('click',()=>showPage('ai'));

const sec=document.createElement('section');sec.className='page hidden';sec.id='aiPage';
sec.innerHTML=`
<div class="panel"><div class="panel-head"><div class="panel-heading"><div class="section-icon">🔑</div><div><h2>Conexiune AI</h2><p>Opțională: analiza locală funcționează și fără ea.</p></div></div><span class="ai-badge" id="aiState"></span></div><div class="ai-body">
 <div class="ai-key"><input type="password" id="aiKey" placeholder="Cheia ta API Anthropic (sk-ant-...)" autocomplete="off" aria-label="Cheia API"><select id="aiModel" aria-label="Model"><option value="claude-haiku-5-5">Haiku (rapid, ieftin)</option><option value="claude-sonnet-5-5">Sonnet (echilibrat)</option><option value="claude-opus-5-5">Opus (cel mai atent)</option></select><button class="btn primary" id="aiSaveKey" type="button">Salvează</button><button class="btn white" id="aiClearKey" type="button">Șterge cheia</button></div>
 <label class="ai-check"><input type="checkbox" id="aiNotes"> Trimite și motivele/observațiile de la puncte (pot conține informații personale)</label>
 <p class="ai-note">Cheia rămâne doar în browserul acestui dispozitiv. Către AI se trimit numai date anonimizate (Elev 1, Elev 2…): puncte, note, număr de înregistrări. Numele reale nu pleacă de pe dispozitiv; ele sunt puse la loc local, în răspuns. Pe un computer folosit și de alte persoane, șterge cheia după lucru.</p></div></div>

<div class="panel"><div class="panel-head"><div class="panel-heading"><div class="section-icon">◔</div><div><h2>Analiza clasei</h2><p>Cine are nevoie de atenție, cine excelează, cum evoluează ritmul.</p></div></div><div class="controls"><button class="btn light" id="aiLocal" type="button">Analiză rapidă (local)</button><button class="btn primary" id="aiDeep" type="button">Analiză cu AI</button></div></div><div class="ai-body"><div class="ai-out hidden" id="aiAnalysis"></div><p class="ai-note" id="aiAnalysisHint">Apasă un buton ca să vezi analiza clasei active.</p></div></div>

<div class="panel"><div class="panel-head"><div class="panel-heading"><div class="section-icon">✎</div><div><h2>Observație pentru elev</h2><p>Text gata de copiat în raport sau în carnetul elevului.</p></div></div></div><div class="ai-body">
 <div class="ai-row"><div class="form-row"><label for="aiStudent">Elev</label><select id="aiStudent"></select></div><div class="form-row"><label for="aiTone">Ton</label><select id="aiTone"><option>încurajator</option><option>neutru</option><option>exigent, dar politicos</option></select></div><button class="btn primary" id="aiRemark" type="button">Generează cu AI</button><button class="btn white" id="aiRemarkLocal" type="button">Șablon local</button></div>
 <div class="ai-out hidden" id="aiRemarkOut"><textarea id="aiRemarkText" aria-label="Observația generată"></textarea><div class="modal-actions"><button class="btn light" id="aiCopy" type="button">Copiază</button></div></div></div></div>

<div class="panel"><div class="panel-head"><div class="panel-heading"><div class="section-icon">?</div><div><h2>Generator de întrebări</h2><p>Creează întrebări grilă și adaugă-le în Quiz-ul geografic.</p></div></div></div><div class="ai-body">
 <div class="ai-row"><div class="form-row"><label for="aiTopic">Tema</label><input id="aiTopic" maxlength="100" placeholder="Ex.: Relieful României, Clima Europei"></div><div class="form-row" style="max-width:130px"><label for="aiCount">Câte întrebări</label><input id="aiCount" type="number" min="3" max="10" value="5"></div><div class="form-row" style="max-width:170px"><label for="aiLevel">Nivel</label><select id="aiLevel"><option>gimnaziu</option><option selected>liceu</option><option>bacalaureat</option></select></div><button class="btn primary" id="aiGen" type="button">Generează</button></div>
 <div class="ai-out hidden" id="aiQOut"><div id="aiQList"></div><div class="modal-actions"><button class="btn primary" id="aiQAdd" type="button">Adaugă selectate în Quiz</button></div></div>
 <p class="ai-note">Verifică întotdeauna întrebările înainte să le folosești: AI-ul poate greși.</p></div></div>

<div class="panel"><div class="panel-head"><div class="panel-heading"><div class="section-icon">💬</div><div><h2>Întreabă asistentul</h2><p>Ex.: „Propune o activitate pentru elevii cu puține puncte” sau „Cum pot motiva clasa?”</p></div></div></div><div class="ai-body">
 <div class="form-row"><label for="aiAsk">Întrebarea ta</label><textarea id="aiAsk" maxlength="800" placeholder="Scrie aici…"></textarea></div><div class="modal-actions" style="margin-top:0"><button class="btn primary" id="aiAskBtn" type="button">Trimite</button></div>
 <div class="ai-out hidden" id="aiAskOut"></div></div></div>`;
document.querySelector('.footer').before(sec);

const $a=id=>document.getElementById(id);
function refresh(){
  $a('aiKey').value=S.key;$a('aiModel').value=S.model;$a('aiNotes').checked=!!S.notes;
  $a('aiState').textContent=S.key?'AI conectat':'Doar analiză locală';
  const cur=$a('aiStudent').value;$a('aiStudent').innerHTML=cls().students.map(s=>`<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)}</option>`).join('');if(cls().students.some(s=>s.id===cur))$a('aiStudent').value=cur;
  ['aiAnalysis','aiRemarkOut','aiAskOut'].forEach(i=>$a(i).classList.add('hidden'))}

$a('aiSaveKey').addEventListener('click',()=>{S.key=$a('aiKey').value.trim();S.model=$a('aiModel').value;S.notes=$a('aiNotes').checked;save();refresh();showToast(S.key?'Conexiunea AI a fost salvată.':'Introdu cheia API.',!S.key)});
$a('aiClearKey').addEventListener('click',()=>{S.key='';save();refresh();showToast('Cheia a fost ștearsă din acest browser.')});
$a('aiNotes').addEventListener('change',e=>{S.notes=e.target.checked;save()});

function showAnalysis(html){const o=$a('aiAnalysis');o.innerHTML=html;o.classList.remove('hidden');$a('aiAnalysisHint').classList.add('hidden')}
$a('aiLocal').addEventListener('click',()=>showAnalysis('<span class="ai-badge">ANALIZĂ LOCALĂ</span><ul>'+localInsights().map(x=>`<li>${rich(x)}</li>`).join('')+'</ul>'));
$a('aiDeep').addEventListener('click',e=>run(e.currentTarget,async()=>{
  const txt=await ask('Ești un asistent pentru un profesor de geografie. Răspunzi în română, concis (maxim 220 de cuvinte), cu 4–6 puncte practice. Elevii sunt anonimizați ca „Elev N”. Nu inventa date care nu apar în listă. Include: ce merge bine, cine are nevoie de atenție, 2 acțiuni concrete pentru următoarea lecție.',ctx(),900);
  showAnalysis('<span class="ai-badge">ANALIZĂ AI</span><div style="margin-top:8px">'+rich(deanon(txt))+'</div>')}));

function showRemark(t){$a('aiRemarkText').value=t;$a('aiRemarkOut').classList.remove('hidden')}
$a('aiRemarkLocal').addEventListener('click',()=>showRemark(localRemark($a('aiStudent').value)));
$a('aiRemark').addEventListener('click',e=>run(e.currentTarget,async()=>{
  const sid=$a('aiStudent').value,c=cls(),max=maxTotal(),tot=totalFor(sid),notes=S.notes?c.logs.filter(x=>x.sid===sid).map(x=>x.note).filter(Boolean).slice(0,10).join('; '):'';
  const data=`Puncte: ${tot} din maximul clasei ${max} (${max?Math.round(tot*100/max):0}%). Nota automată: ${gradeFor(sid)}/10. Număr de înregistrări: ${countFor(sid)}. Media clasei: ${fmt(c.students.reduce((s,x)=>s+totalFor(x.id),0)/c.students.length)} puncte.`+(notes?` Motive ale punctelor: ${notes}.`:'');
  const txt=await ask(`Ești profesor de geografie. Scrie în română o observație de 2–3 propoziții despre un elev, pentru raport sau carnet. Ton: ${$a('aiTone').value}. Folosește doar datele primite, nu inventa fapte, nu pomeni numele și nu compara cu alți elevi anume. Dacă nu are puncte, formulează constructiv.`,data,400);
  showRemark(txt)}));
$a('aiCopy').addEventListener('click',async()=>{const t=$a('aiRemarkText').value;try{await navigator.clipboard.writeText(t);showToast('Observația a fost copiată.')}catch(e){$a('aiRemarkText').select();showToast('Selectează textul și copiază-l manual.',true)}});

function renderGen(){$a('aiQList').innerHTML=genQs.map((q,i)=>`<label class="ai-q"><input type="checkbox" data-aiq="${i}" checked><span><strong>${escapeHtml(q.q)}</strong><small>${q.a.map((x,j)=>(j===q.c?'✔ ':'')+String.fromCharCode(65+j)+'. '+escapeHtml(x)).join(' · ')}</small><small>${escapeHtml(q.info)}</small></span></label>`).join('');$a('aiQOut').classList.toggle('hidden',!genQs.length)}
$a('aiGen').addEventListener('click',e=>run(e.currentTarget,async()=>{
  const topic=cleanSpaces($a('aiTopic').value);if(!topic){showToast('Scrie tema întrebărilor.',true);return}
  const n=Math.max(3,Math.min(10,Number($a('aiCount').value)||5));
  const txt=await ask('Ești profesor de geografie. Răspunzi EXCLUSIV cu un array JSON valid, fără text în plus și fără ```.',`Generează ${n} întrebări grilă în limba română, nivel ${$a('aiLevel').value}, pe tema „${topic}”. Format: [{"q":"întrebarea","a":["varianta A","varianta B","varianta C","varianta D"],"c":indexul_răspunsului_corect_0_până_la_3,"info":"explicație scurtă"}]. Exact 4 variante, una singură corectă; variază poziția răspunsului corect. Folosește doar fapte sigure.`,2800);
  const m=txt.match(/\[[\s\S]*\]/);let arr;try{arr=JSON.parse(m?m[0]:txt)}catch(err){throw new Error('răspuns neașteptat, încearcă din nou')}
  genQs=(Array.isArray(arr)?arr:[]).filter(valid).map(clean);if(!genQs.length)throw new Error('nu s-au primit întrebări valide');renderGen()}));
$a('aiQAdd').addEventListener('click',()=>{
  const picked=[...document.querySelectorAll('[data-aiq]:checked')].map(x=>genQs[Number(x.dataset.aiq)]).filter(Boolean);
  const have=new Set(geoQuestions.map(q=>norm(q.q)));let added=0;
  picked.forEach(q=>{if(!have.has(norm(q.q))){geoQuestions.push(q);savedQs.push(q);have.add(norm(q.q));added++}});
  saveQs();showToast(added?`Au fost adăugate ${added} ${pl(added,'întrebare','întrebări')} în Quiz.`:'Întrebările selectate există deja în Quiz.',!added)});

$a('aiAskBtn').addEventListener('click',e=>run(e.currentTarget,async()=>{
  const q=cleanSpaces($a('aiAsk').value);if(!q){showToast('Scrie întrebarea.',true);return}
  const txt=await ask('Ești asistentul unui profesor de geografie din Moldova/România. Răspunzi în română, concis și practic. Elevii din date sunt anonimizați ca „Elev N”; nu cere nume reale.',`Date despre clasă:\n${ctx()}\n\nÎntrebarea profesorului: ${q}`,1000);
  const o=$a('aiAskOut');o.innerHTML=rich(deanon(txt));o.classList.remove('hidden')}));

// ---------- Integrare în aplicația existentă ----------
const _pageInfo=pageInfo;window.pageInfo=p=>p==='ai'?['ASISTENT AI','Asistent AI',`Clasa ${cls().name} · Analize, observații și întrebări generate cu AI`]:_pageInfo(p);
const _renderAll=renderAll;window.renderAll=function(){_renderAll();refresh()};
refresh();
})();
