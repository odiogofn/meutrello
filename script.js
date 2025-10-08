/************** CONFIG **************/
const apiKey  = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken= "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

/************** DOM **************/
const boardSelect = document.getElementById('boardSelect');
const listSelect  = document.getElementById('listSelect');
const refreshBtn  = document.getElementById('refreshCards');
const openCreateModalBtn = document.getElementById('openCreateModal');

const cardsListEl   = document.getElementById('cardsList');
const cardDetailsEl = document.getElementById('cardDetails');

const searchSection = document.getElementById('searchSection');
const searchInput   = document.getElementById('searchInput');

const createModal       = document.getElementById('createModal');
const closeCreateModal  = document.getElementById('closeCreateModal');
const cancelCreate      = document.getElementById('cancelCreate');
const createCardBtn     = document.getElementById('createCardBtn');
const newCardName       = document.getElementById('newCardName');
const newCardDesc       = document.getElementById('newCardDesc');
const newCardMembers    = document.getElementById('newCardMembers');
const newCardLabels     = document.getElementById('newCardLabels');
const pickFiles         = document.getElementById('pickFiles');
const fileInput         = document.getElementById('fileInput');
const dropZone          = document.getElementById('dropZone');
const previewList       = document.getElementById('previewList');
const createFeedback    = document.getElementById('createFeedback');

const cardItemTpl  = document.getElementById('cardItemTpl');
const labelPillTpl = document.getElementById('labelPillTpl');

/************** STATE **************/
let boards = [];
let listsByBoard = new Map();
let currentBoard = null;
let currentList  = null;

let boardMembers = [];
let boardLabels  = [];

let allCards = [];
let attachmentsToUpload = []; // criação de card

/************** HELPERS **************/
const TRELLO = (path, params={}) => {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', apiToken);
  Object.entries(params).forEach(([k,v])=> (v!==undefined && v!==null) && url.searchParams.set(k, v));
  return url.toString();
};
const fmtDate = s => s ? new Date(s).toLocaleString() : '—';
const el = (t,c) => { const e=document.createElement(t); if(c) e.className=c; return e; }
const clearChildren = e => { while(e.firstChild) e.removeChild(e.firstChild); }

/************** INIT LOAD **************/
async function loadBoards(){
  const res = await fetch(TRELLO('members/me/boards', { filter:'open', fields:'name' }));
  boards = await res.json();
  boardSelect.innerHTML = '<option value="">Selecione um quadro...</option>';
  boards.forEach(b=>{
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    boardSelect.appendChild(o);
  });
}
async function loadLists(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/lists`, { filter:'open', fields:'name' }));
  const lists = await res.json();
  listsByBoard.set(boardId, lists);
  listSelect.innerHTML = '<option value="">Selecione uma lista...</option>';
  lists.forEach(l=>{
    const o = document.createElement('option');
    o.value = l.id; o.textContent = l.name;
    listSelect.appendChild(o);
  });
  listSelect.disabled = false;
  openCreateModalBtn.disabled = false;
}
async function loadBoardMembers(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/members`, { fields:'fullName,username' }));
  boardMembers = await res.json();
  // Preencher select do modal
  newCardMembers.innerHTML = '';
  boardMembers.forEach(m=>{
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = `${m.fullName} (@${m.username})`;
    newCardMembers.appendChild(o);
  });
}
async function loadBoardLabels(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/labels`, { fields:'name,color', limit:1000 }));
  boardLabels = await res.json();
  // Preencher select do modal
  newCardLabels.innerHTML = '';
  boardLabels.forEach(lb=>{
    const o = document.createElement('option');
    o.value = lb.id;
    o.textContent = lb.name ? `${lb.name} (${lb.color||'sem cor'})` : (lb.color || 'sem nome');
    newCardLabels.appendChild(o);
  });
}

/************** CARDS **************/
async function loadCards(listId){
  const res = await fetch(TRELLO(`lists/${listId}/cards`, {
    fields:'name,desc,labels,idMembers,dateLastActivity,shortLink'
  }));
  allCards = await res.json();
  renderCards(allCards);
  searchSection.style.display = 'block';
}
function renderCards(cards){
  clearChildren(cardsListEl);
  if(!cards.length){
    cardsListEl.innerHTML = '<p>Nenhum card nesta lista.</p>';
    cardDetailsEl.classList.add('hidden');
    return;
  }
  cards.forEach(card=>{
    const node = cardItemTpl.content.cloneNode(true);
    node.querySelector('.card-title').textContent = card.name;
    // Labels
    const ll = node.querySelector('.label-list');
    card.labels?.forEach(lb=>{
      const pill = labelPillTpl.content.cloneNode(true);
      pill.querySelector('.label-pill').textContent = lb.name || lb.color || 'Etiqueta';
      ll.appendChild(pill);
    });
    // Ações
    node.querySelector('.view-details').onclick = ()=> showCardDetails(card.id);
    node.querySelector('.move-card').onclick   = ()=> openMoveDialog(card);
    cardsListEl.appendChild(node);
  });
}

/************** BUSCA **************/
searchInput.addEventListener('input', ()=>{
  const q = searchInput.value.toLowerCase().trim();
  if(!q) return renderCards(allCards);
  const filtered = allCards.filter(c=>{
    const inN = c.name?.toLowerCase().includes(q);
    const inD = c.desc?.toLowerCase().includes(q);
    const inL = c.labels?.some(lb => (lb.name || lb.color || '').toLowerCase().includes(q));
    const inM = c.idMembers?.some(id=>{
      const m = boardMembers.find(mm=>mm.id===id);
      return m && (m.fullName.toLowerCase().includes(q) || m.username.toLowerCase().includes(q));
    });
    return inN || inD || inL || inM;
  });
  renderCards(filtered);
});

/************** DETALHES: MEMBROS, ANEXOS, COMENTÁRIOS + COMENTAR **************/
async function showCardDetails(cardId){
  const [card, members, attachments, comments] = await Promise.all([
    fetch(TRELLO(`cards/${cardId}`, { fields:'name,desc,labels,shortUrl,dateLastActivity' })).then(r=>r.json()),
    fetch(TRELLO(`cards/${cardId}/members`, { fields:'fullName,username' })).then(r=>r.json()),
    fetch(TRELLO(`cards/${cardId}/attachments`, { fields:'name,url,bytes,date,previews' })).then(r=>r.json()),
    fetch(TRELLO(`cards/${cardId}/actions`, { filter:'commentCard', fields:'data,date,memberCreator' })).then(r=>r.json())
  ]);

  cardDetailsEl.classList.remove('hidden');
  clearChildren(cardDetailsEl);

  // Cabeçalho
  const h = el('div');
  const title = el('h3'); title.textContent = card.name;
  const meta  = el('div','muted'); meta.textContent = `Última atividade: ${fmtDate(card.dateLastActivity)} · `;
  const link  = el('a'); link.href = card.shortUrl; link.target='_blank'; link.rel='noopener'; link.textContent='Abrir no Trello';
  meta.appendChild(link);
  h.appendChild(title); h.appendChild(meta);

  // Descrição
  const desc = el('div','info-block');
  desc.innerHTML = `<h3>Descrição</h3><div>${card.desc || '—'}</div>`;

  // Membros
  const mem = el('div','info-block');
  mem.innerHTML = '<h3>Membros</h3>';
  if(members.length){
    const wrap = el('div');
    members.forEach(m=>{
      const p = el('span','pill');
      p.textContent = `${m.fullName} (@${m.username})`;
      wrap.appendChild(p);
    });
    mem.appendChild(wrap);
  } else mem.innerHTML += '<div>—</div>';

  // Etiquetas
  const lbs = el('div','info-block');
  lbs.innerHTML = '<h3>Etiquetas</h3>';
  if(card.labels?.length){
    const wrap = el('div');
    card.labels.forEach(lb=>{
      const p = el('span','pill');
      p.textContent = lb.name || lb.color || 'Etiqueta';
      wrap.appendChild(p);
    });
    lbs.appendChild(wrap);
  } else lbs.innerHTML += '<div>—</div>';

  // Anexos
  const att = el('div','info-block');
  att.innerHTML = `<h3>Anexos (${attachments.length})</h3>`;
  const attWrap = el('div');
  if(attachments.length){
    attachments.forEach(a=>{
      const row = el('div','attachment');
      if(a.previews?.length){ // mini preview se houver
        const img = new Image();
        img.src = a.previews[0].url;
        img.alt = a.name;
        img.style.maxHeight = '50px';
        img.style.borderRadius='4px';
        row.appendChild(img);
      }
      const meta = el('div');
      meta.innerHTML = `<div>${a.name}</div><a href="${a.url}" target="_blank">Abrir</a><div class="muted">${fmtDate(a.date)}</div>`;
      row.appendChild(meta);
      attWrap.appendChild(row);
    });
  } else attWrap.innerHTML = '<div>—</div>';
  att.appendChild(attWrap);

  // Comentários
  const com = el('div','info-block');
  com.innerHTML = `<h3>Comentários (${comments.length})</h3>`;
  const comWrap = el('div');
  if(comments.length){
    comments.forEach(c=>{
      const row = el('div','history-item');
      row.innerHTML = `<b>${c.memberCreator?.fullName || 'Alguém'}:</b> ${c.data?.text || ''} <span class="muted">— ${fmtDate(c.date)}</span>`;
      comWrap.appendChild(row);
    });
  } else comWrap.innerHTML = '<div>—</div>';
  com.appendChild(comWrap);

  // Adicionar comentário + imagens (colar/arrastar)
  const add = el('div','info-block');
  add.innerHTML = `
    <h3>Adicionar comentário / imagem</h3>
    <textarea id="newComment" rows="3" placeholder="Escreva um comentário ou cole uma imagem..."></textarea>
    <div id="commentPreview" class="preview-list"></div>
    <button id="sendComment" class="btn primary" style="margin-top:6px;">Enviar</button>
  `;

  cardDetailsEl.append(h, desc, mem, lbs, att, com, add);

  const commentBox = document.getElementById('newComment');
  const sendBtn    = document.getElementById('sendComment');
  const cPreview   = document.getElementById('commentPreview');
  let commentImages = [];

  function renderCommentPreviews(){
    clearChildren(cPreview);
    if(!commentImages.length){
      cPreview.innerHTML = '<div class="muted">Nenhuma imagem adicionada.</div>';
      return;
    }
    commentImages.forEach((it,idx)=>{
      const box = el('div','preview-item');
      const img = new Image(); img.src = it.url; img.style.maxWidth='120px'; img.style.display='block';
      const name = el('div','preview-name'); name.textContent = it.name || 'imagem';
      const rm = el('span','preview-remove'); rm.textContent='Remover';
      rm.onclick = ()=>{ commentImages.splice(idx,1); renderCommentPreviews(); }
      box.append(img,name,rm);
      cPreview.appendChild(box);
    });
  }

  // PASTE imagens
  commentBox.addEventListener('paste', e=>{
    const items = e.clipboardData?.items || [];
    for(const it of items){
      if(it.kind==='file' && it.type.startsWith('image/')){
        const f = it.getAsFile();
        const r = new FileReader();
        r.onload = ()=>{ commentImages.push({file:f, url:r.result, name:f.name}); renderCommentPreviews(); }
        r.readAsDataURL(f);
      }
    }
  });
  // Drag & Drop imagens
  commentBox.addEventListener('dragover', e=> e.preventDefault());
  commentBox.addEventListener('drop', e=>{
    e.preventDefault();
    const files = e.dataTransfer?.files || [];
    for(const f of files){
      if(f.type.startsWith('image/')){
        const r = new FileReader();
        r.onload = ()=>{ commentImages.push({file:f, url:r.result, name:f.name}); renderCommentPreviews(); }
        r.readAsDataURL(f);
      }
    }
  });

  // Enviar comentário + imagens
  sendBtn.onclick = async ()=>{
    const txt = commentBox.value.trim();

    if(!txt && !commentImages.length){
      alert('Digite um comentário ou adicione uma imagem.');
      return;
    }
    // 1) Envia comentário (se houver)
    if(txt){
      const res = await fetch(TRELLO(`cards/${cardId}/actions/comments`, { text: txt }), { method:'POST' });
      if(res.ok){
        const row = el('div','history-item');
        row.innerHTML = `<b>Você:</b> ${txt} <span class="muted">— agora</span>`;
        comWrap.appendChild(row);
        commentBox.value = '';
      }
    }
    // 2) Envia imagens como anexos
    for(const it of commentImages){
      const form = new FormData();
      form.append('file', it.file, it.name || 'imagem.png');
      const up = await fetch(TRELLO(`cards/${cardId}/attachments`), { method:'POST', body: form });
      if(up.ok){
        // Add visual rápido no painel
        const row = el('div','attachment');
        const name = it.name || 'Nova imagem';
        row.innerHTML = `<div>${name}</div><div class="muted">— enviado agora</div>`;
        attWrap.appendChild(row);
      }
    }
    commentImages = [];
    renderCommentPreviews();
  };
}

/************** MOVER CARD **************/
async function openMoveDialog(cardLite){
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Mover "${cardLite.name}"</h3>
      <label>Quadro</label>
      <select id="moveBoard"></select>
      <label>Lista</label>
      <select id="moveList"></select>
      <div style="margin-top:10px;text-align:right;">
        <button id="confirmMove" class="btn primary">Mover</button>
        <button id="cancelMove" class="btn">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const moveBoard = modal.querySelector('#moveBoard');
  const moveList  = modal.querySelector('#moveList');
  const confirm   = modal.querySelector('#confirmMove');
  const cancel    = modal.querySelector('#cancelMove');

  // Boards
  boards.forEach(b=>{
    const o = document.createElement('option');
    o.value = b.id; o.textContent = b.name;
    if(currentBoard && b.id===currentBoard.id) o.selected = true;
    moveBoard.appendChild(o);
  });

  async function fillMoveLists(boardId){
    const res = await fetch(TRELLO(`boards/${boardId}/lists`, { filter:'open', fields:'name' }));
    const lists = await res.json();
    moveList.innerHTML = '';
    lists.forEach(l=>{
      const o = document.createElement('option');
      o.value = l.id; o.textContent = l.name;
      if(currentList && boardId===currentBoard.id && l.id===currentList.id) o.selected = true;
      moveList.appendChild(o);
    });
  }
  await fillMoveLists(moveBoard.value);
  moveBoard.onchange = ()=> fillMoveLists(moveBoard.value);

  cancel.onclick = ()=> modal.remove();
  confirm.onclick = async ()=>{
    const idBoard = moveBoard.value;
    const idList  = moveList.value;
    const res = await fetch(TRELLO(`cards/${cardLite.id}`, { idBoard, idList }), { method:'PUT' });
    if(res.ok){
      alert('✅ Card movido!');
      modal.remove();
      if(currentList?.id) loadCards(currentList.id);
    } else {
      alert('❌ Não foi possível mover o card.');
    }
  };
}

/************** MODAL CRIAR CARD **************/
function openCreateModal(){
  createModal.classList.remove('hidden');
  createModal.setAttribute('aria-hidden','false');
  createFeedback.textContent = '';
  newCardName.value = '';
  newCardDesc.value = '';
  attachmentsToUpload = [];
  renderPreviews();
  if(currentBoard) loadBoardLabels(currentBoard.id); // garante labels atualizadas
}
function closeCreate(){
  createModal.classList.add('hidden');
  createModal.setAttribute('aria-hidden','true');
  newCardName.value = '';
  newCardDesc.value = '';
  attachmentsToUpload = [];
  renderPreviews();
  createFeedback.textContent = '';
}
openCreateModalBtn.addEventListener('click', openCreateModal);
closeCreateModal.addEventListener('click', (e)=>{ e.preventDefault(); closeCreate(); });
cancelCreate.addEventListener('click', (e)=>{ e.preventDefault(); closeCreate(); });

/************** CRIAR CARD **************/
createCardBtn.addEventListener('click', async (e)=>{
  e.preventDefault();
  if(!currentList?.id){ createFeedback.textContent = '⚠️ Selecione o quadro e a lista.'; createFeedback.className='feedback error'; return; }
  const name = newCardName.value.trim();
  if(!name){ createFeedback.textContent = '⚠️ Informe o nome do card.'; createFeedback.className='feedback error'; return; }
  const desc = newCardDesc.value.trim();
  const idMembers = Array.from(newCardMembers.selectedOptions).map(o=>o.value);
  const idLabels  = Array.from(newCardLabels.selectedOptions).map(o=>o.value);

  // Cria o card
  const res = await fetch(TRELLO('cards', {
    idList: currentList.id, name, desc,
    idMembers: idMembers.join(','), idLabels: idLabels.join(','), pos:'top'
  }), { method:'POST' });
  if(!res.ok){ createFeedback.textContent='❌ Erro ao criar card.'; createFeedback.className='feedback error'; return; }
  const card = await res.json();

  // Envia anexos
  for(const it of attachmentsToUpload){
    if(it.file){
      const form = new FormData();
      form.append('file', it.file, it.name || it.file.name);
      await fetch(TRELLO(`cards/${card.id}/attachments`), { method:'POST', body: form });
    }
  }

  createFeedback.innerHTML = `✅ Card criado! <a href="${card.shortUrl}" target="_blank" rel="noopener">Abrir ↗</a>`;
  createFeedback.className = 'feedback success';
  setTimeout(()=>{ closeCreate(); if(currentList?.id) loadCards(currentList.id); }, 1000);
});

/************** UPLOADER (CRIAR CARD) **************/
function renderPreviews(){
  clearChildren(previewList);
  if(!attachmentsToUpload.length){
    previewList.innerHTML = '<div class="muted">Nenhum anexo adicionado.</div>';
    return;
  }
  attachmentsToUpload.forEach((item,idx)=>{
    const box = el('div','preview-item');
    const name = el('div','preview-name'); name.textContent = item.name || (item.file && item.file.name) || 'anexo';
    const rm = el('span','preview-remove'); rm.textContent = 'Remover';
    rm.onclick = ()=>{ attachmentsToUpload.splice(idx,1); renderPreviews(); };
    box.append(name, rm);
    previewList.appendChild(box);
  });
}
pickFiles.addEventListener('click', ()=> fileInput.click());
fileInput.addEventListener('change', e=>{
  Array.from(e.target.files).forEach(f=> attachmentsToUpload.push({file:f, name:f.name}));
  renderPreviews();
});
['dragenter','dragover'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.add('dragover'); });
});
['dragleave','drop'].forEach(evt=>{
  dropZone.addEventListener(evt, e=>{ e.preventDefault(); e.stopPropagation(); dropZone.classList.remove('dragover'); });
});
dropZone.addEventListener('drop', e=>{
  const files = e.dataTransfer?.files || [];
  if(files.length){
    Array.from(files).forEach(f=> attachmentsToUpload.push({file:f, name:f.name}));
    renderPreviews();
  }
});
dropZone.addEventListener('paste', e=>{
  const items = e.clipboardData?.items || [];
  for(const it of items){
    if(it.kind==='file'){
      const f = it.getAsFile();
      if(f) attachmentsToUpload.push({file:f, name:f.name});
    }
  }
  renderPreviews();
});

/************** EVENTOS SUPERIORES **************/
boardSelect.addEventListener('change', async ()=>{
  const id = boardSelect.value;
  cardDetailsEl.classList.add('hidden');
  clearChildren(cardsListEl);
  if(!id){
    listSelect.disabled = true; openCreateModalBtn.disabled = true;
    listSelect.innerHTML = '<option value="">Selecione uma lista...</option>';
    return;
  }
  currentBoard = boards.find(b=> b.id===id);
  await loadLists(id);
  await loadBoardMembers(id);
  await loadBoardLabels(id);
});
listSelect.addEventListener('change', async ()=>{
  const id = listSelect.value;
  cardDetailsEl.classList.add('hidden');
  if(!id){
    clearChildren(cardsListEl); return;
  }
  currentList = (listsByBoard.get(currentBoard.id)||[]).find(l=> l.id===id);
  await loadCards(id);
});
refreshBtn.addEventListener('click', ()=> currentList?.id && loadCards(currentList.id));

/************** BOOT **************/
loadBoards().catch(err=>{
  console.error(err);
  alert('Erro ao carregar quadros. Verifique key/token e permissões da API.');
});
