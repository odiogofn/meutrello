let events=[],boards=[];
const resolveCardId=e=>e.cardId||((e.cardUrl||"").match(/\/c\/([A-Za-z0-9]{8,24})(?:[/?#]|$)/i)||[])[1]||"";const $=id=>document.getElementById(id);const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const icons={create:'+',transfer:'⇄',move:'↪',archive:'▣',restore:'↩',delete:'×',comment:'✎',reaction:'♥'};const date=s=>new Date(s).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'medium'});
function render(){const q=$('search').value.toLowerCase(),board=$('boardFilter').value,type=$('typeFilter').value;const list=events.filter(e=>(!board||e.boardId===board)&&(!type||e.type===type)&&(!q||[e.actor,e.card,e.board,e.from,e.to,e.comment,...(e.labels||[]).map(l=>l.name)].join(' ').toLowerCase().includes(q)));$('total').textContent=events.length;$('transfers').textContent=events.filter(e=>e.type==='transfer').length;$('archives').textContent=events.filter(e=>e.type==='archive').length;
$('feed').innerHTML=list.length?list.slice(0,500).map(e=>{let sentence=`<b>${esc(e.actor)}</b> ${esc(e.detail)} <b>${esc(e.card)}</b>`;if(e.type==='transfer')sentence+=` do quadro <b>${esc(e.from)}</b> para <b>${esc(e.to)}</b>`;else if(e.type==='move')sentence+=` de <b>${esc(e.from)}</b> para <b>${esc(e.to)}</b>`;else sentence+=` no quadro <b>${esc(e.board)}</b>`;return `<div class="event ${esc(e.type)}"><div class="dot">${icons[e.type]||'•'}</div><div class="content"><div class="sentence">${sentence}</div><div class="meta">${date(e.date)}</div>${e.labels?.length?`<div class="event-labels"><span>Etiquetas atuais:</span>${e.labels.map(l=>`<span class="event-label">${esc(l.name||l.color||"Sem nome")}</span>`).join("")}</div>`:""}${e.comment?`<div class="quote">${esc(e.comment)}</div>`:""}${e.type==="comment"&&e.cardUrl?`<button type="button" class="reply-trigger" data-event="${esc(e.id)}">↩ Responder</button>`:""}<div class="links">${e.cardUrl?`<a href="${esc(e.cardUrl)}" target="_blank" rel="noopener">Abrir cartão ↗</a>`:''}${e.boardUrl?`<a href="${esc(e.boardUrl)}" target="_blank" rel="noopener">Abrir quadro ↗</a>`:''}</div></div></div>`}).join(''):'<div class="empty">Nenhuma atividade encontrada.</div>'}
function updateBoards(b){boards=b;const current=$('boardFilter').value;$('boardFilter').innerHTML='<option value="">Todos os quadros</option>'+b.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('');$('boardFilter').value=current;$('boards').innerHTML=b.map(x=>`<a class="board" href="${esc(x.url)}" target="_blank" rel="noopener">▦ &nbsp;${esc(x.name)}</a>`).join('')}
function status(s){$('status').textContent=s.error?'Erro de conexão':(autoEnabled?'Monitorando automaticamente':'Atualização pausada');if(s.lastSync){$('updated').textContent=new Date(s.lastSync).toLocaleTimeString('pt-BR');$('lastSyncLabel').textContent='Última atualização: '+new Date(s.lastSync).toLocaleTimeString('pt-BR');}if(s.boards)updateBoards(s.boards);if(s.error)console.warn(s.error)}
const STORAGE_KEY='meutrello-monitor-vercel-events-v1';const AUTO_KEY='meutrello-monitor-auto-v1';const INTERVAL_MS=30000;let autoEnabled=localStorage.getItem(AUTO_KEY)!=='false';let busy=false;let latestSync='';let nextPollAt=Date.now();
try{const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');if(Array.isArray(saved))events=saved.slice(0,2000)}catch{}
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(events.slice(0,2000)))}catch{}}
async function poll(force=false){if(busy||(!force&&(!autoEnabled||document.hidden)))return;busy=true;try{const u=new URL('/api/state',location.origin);if(latestSync)u.searchParams.set('since',new Date(Date.parse(latestSync)-120000).toISOString());const r=await fetch(u,{cache:'no-store'});const s=await r.json();if(!r.ok)throw Error(s.error||`HTTP ${r.status}`);const ids=new Set(events.map(e=>e.id));for(const e of s.events||[]){const idx=events.findIndex(old=>old.id===e.id);if(idx<0){events.push(e);ids.add(e.id)}else{events[idx]={...events[idx],...e}}}events.sort((a,b)=>b.date.localeCompare(a.date));events=events.slice(0,2000);latestSync=s.lastSync;save();status(s);render()}catch(e){$('status').textContent='Erro: '+e.message;console.error(e)}finally{busy=false;nextPollAt=Date.now()+INTERVAL_MS;renderSyncControls()}}
function renderSyncControls(){const btn=$('toggleAuto');btn.textContent=autoEnabled?'⏸ Pausar atualização':'▶ Retomar atualização';btn.setAttribute('aria-pressed',String(autoEnabled));$('nextSyncLabel').textContent=!autoEnabled?'Próxima consulta: pausada':document.hidden?'Próxima consulta: aba em segundo plano':busy?'Próxima consulta: sincronizando...':'Próxima consulta em '+Math.max(0,Math.ceil((nextPollAt-Date.now())/1000))+'s';if(!autoEnabled&&!busy)$('status').textContent='Atualização pausada';}
$('toggleAuto').addEventListener('click',()=>{autoEnabled=!autoEnabled;localStorage.setItem(AUTO_KEY,String(autoEnabled));if(autoEnabled){nextPollAt=Date.now()+INTERVAL_MS;$('status').textContent='Monitorando automaticamente'}renderSyncControls()});
$('refreshNow').addEventListener('click',()=>poll(true));
$('boardMenuButton').addEventListener('click',()=>{const menu=$('boards');menu.hidden=!menu.hidden;$('boardMenuButton').setAttribute('aria-expanded',String(!menu.hidden))});
document.addEventListener('click',e=>{if(!e.target.closest('.board-menu')){$('boards').hidden=true;$('boardMenuButton').setAttribute('aria-expanded','false')}});
['search','boardFilter','typeFilter'].forEach(id=>$(id).addEventListener('input',render));
render();renderSyncControls();if(autoEnabled)poll();
setInterval(()=>{if(autoEnabled&&!document.hidden&&!busy&&Date.now()>=nextPollAt)poll();renderSyncControls()},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&autoEnabled){nextPollAt=Date.now();poll()}renderSyncControls()});

let selectedReply=null;
$('feed').addEventListener('click',e=>{
 const btn=e.target.closest('.reply-trigger');if(!btn)return;
 const item=events.find(x=>x.id===btn.dataset.event);if(!item)return;
 selectedReply=item;$('replyContext').textContent=`${item.actor} comentou em "${item.card}": ${item.comment||''}`;
 $('replyText').value='';$('replyError').textContent='';$('replyDialog').showModal();
});
$('cancelReply').addEventListener('click',()=>$('replyDialog').close());
$('replyForm').addEventListener('submit',async e=>{
 e.preventDefault();if(!selectedReply)return;
 const send=$('sendReply');send.disabled=true;send.textContent='Publicando...';$('replyError').textContent='';
 try{
  const text=`Em resposta a ${selectedReply.actor}:\n${$('replyText').value.trim()}`;
  const r=await fetch('/api/comment',{method:'POST',headers:{'Content-Type':'application/json','X-Monitor-Password':$('replyPassword').value},body:JSON.stringify({cardId:resolveCardId(selectedReply),cardUrl:selectedReply.cardUrl,text})});
  const result=await r.json();if(!r.ok)throw Error(result.error||'Não foi possível publicar.');
  $('replyPassword').value='';$('replyDialog').close();await poll(true);
 }catch(err){$('replyError').textContent=err.message}
 finally{send.disabled=false;send.textContent='Publicar resposta'}
});
