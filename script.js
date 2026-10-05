/************** CONFIG **************/
const apiKey  = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken= "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

/************** DOM **************/
const boardsListEl = document.getElementById('boardsList');
const listsListEl = document.getElementById('listsList');
const cardsListEl = document.getElementById('cardsList');

const currentBoardNameEl = document.getElementById('currentBoardName');
const currentListNameEl = document.getElementById('currentListName');
const detailContextEl = document.getElementById('detailContext');

const searchInput = document.getElementById('searchInput');
const refreshCurrentBtn = document.getElementById('refreshCurrentBtn');
const newCardBtn = document.getElementById('newCardBtn');

const closeDetailBtn = document.getElementById('closeDetailBtn');
const detailEmpty = document.getElementById('detailEmpty');
const detailPanel = document.getElementById('detailPanel');

const detailTitle = document.getElementById('detailTitle');
const detailDesc = document.getElementById('detailDesc');
const detailMembers = document.getElementById('detailMembers');
const detailLabels = document.getElementById('detailLabels');
const saveCardBtn = document.getElementById('saveCardBtn');
const moveCardBtn = document.getElementById('moveCardBtn');
const openTrelloLink = document.getElementById('openTrelloLink');

const detailAttachInput = document.getElementById('detailAttachInput');
const uploadAttachmentsBtn = document.getElementById('uploadAttachmentsBtn');
const attachmentsList = document.getElementById('attachmentsList');

const newCommentText = document.getElementById('newCommentText');
const sendCommentBtn = document.getElementById('sendCommentBtn');
const commentsList = document.getElementById('commentsList');

const newCardModal = document.getElementById('newCardModal');
const closeNewCardModalBtn = document.getElementById('closeNewCardModalBtn');
const cancelNewCardBtn = document.getElementById('cancelNewCardBtn');
const createCardBtn = document.getElementById('createCardBtn');
const newCardTitle = document.getElementById('newCardTitle');
const newCardDescription = document.getElementById('newCardDescription');
const newCardMembers = document.getElementById('newCardMembers');
const newCardLabels = document.getElementById('newCardLabels');
const newCardDropZone = document.getElementById('newCardDropZone');
const newCardFileInput = document.getElementById('newCardFileInput');
const newCardFilesPreview = document.getElementById('newCardFilesPreview');
const newCardFeedback = document.getElementById('newCardFeedback');

/************** STATE **************/
let boards = [];
let lists = [];
let cards = [];

let currentBoard = null;
let currentList = null;
let currentCard = null;

let boardMembers = [];
let boardLabels = [];

let newCardFiles = [];

/************** HELPERS **************/
const TRELLO = (path, params={}) => {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', apiToken);
  Object.entries(params).forEach(([k,v])=>{
    if(v !== undefined && v !== null) url.searchParams.set(k, v);
  });
  return url.toString();
};

function clearEl(el){
  while(el.firstChild) el.removeChild(el.firstChild);
}

function fmtDate(value){
  if(!value) return '—';
  return new Date(value).toLocaleString();
}

function showEmptyDetail(){
  document.getElementById('detailDrawer')?.classList.remove('open');
  detailEmpty.classList.remove('hidden');
  detailPanel.classList.add('hidden');
  closeDetailBtn.classList.add('hidden');
  detailContextEl.textContent = 'Nenhum card selecionado';
  currentCard = null;
}

function showDetailPanel(){
  document.getElementById('detailDrawer')?.classList.add('open');
  detailEmpty.classList.add('hidden');
  detailPanel.classList.remove('hidden');
  closeDetailBtn.classList.remove('hidden');
}

function selectedValues(selectEl){
  return Array.from(selectEl.selectedOptions).map(opt => opt.value);
}

function setMultiSelectValues(selectEl, values){
  const set = new Set(values || []);
  Array.from(selectEl.options).forEach(opt=>{
    opt.selected = set.has(opt.value);
  });
}

function renderLabelsInline(labels){
  if(!labels || !labels.length) return '';
  return labels.map(lb => `<span class="label-pill">${lb.name || lb.color || 'Etiqueta'}</span>`).join('');
}

function escapeHtml(text=''){
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

/************** LOADERS **************/
async function loadBoards(){
  const res = await fetch(TRELLO('members/me/boards', {
    filter:'open',
    fields:'name'
  }));
  boards = await res.json();
  renderBoards();
}

async function loadLists(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/lists`, {
    filter:'open',
    fields:'name'
  }));
  lists = await res.json();
  renderLists();
}

async function loadCards(listId){
  const res = await fetch(TRELLO(`lists/${listId}/cards`, {
    fields:'name,desc,labels,idMembers,dateLastActivity,shortUrl'
  }));
  cards = await res.json();
  renderCards(cards);
}

async function loadBoardMembers(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/members`, {
    fields:'fullName,username'
  }));
  boardMembers = await res.json();
  renderBoardMembersOptions();
}

async function loadBoardLabels(boardId){
  const res = await fetch(TRELLO(`boards/${boardId}/labels`, {
    fields:'name,color',
    limit:1000
  }));
  boardLabels = await res.json();
  renderBoardLabelsOptions();
}

/************** RENDERS **************/
function updateMetrics(){
  document.getElementById('metricTotal').textContent = cards.length || (currentList ? '0' : '—');
  document.getElementById('metricList').textContent = currentList ? cards.length : '—';
  document.getElementById('metricListName').textContent = currentList?.name || 'Nenhuma selecionada';
  document.getElementById('metricMembers').textContent = currentBoard ? boardMembers.length : '—';
  document.getElementById('metricLabels').textContent = currentBoard ? boardLabels.length : '—';
}
function toast(message, error=false){
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=message; el.className='toast show'+(error?' error':'');
  clearTimeout(window.__toastTimer); window.__toastTimer=setTimeout(()=>el.className='toast',2600);
}
function renderBoards(){
  clearEl(boardsListEl);
  if(!boards.length){ boardsListEl.innerHTML='<div class="muted">Nenhum quadro.</div>'; return; }
  boards.forEach(board=>{
    const item=document.createElement('div');
    item.className=`board-nav ${currentBoard?.id===board.id?'active':''}`;
    item.textContent=board.name;
    item.onclick=async()=>{
      currentBoard=board; currentList=null; currentCard=null; cards=[];
      currentBoardNameEl.textContent=board.name;
      document.getElementById('pageTitle').textContent=board.name;
      currentListNameEl.textContent='Selecione uma lista';
      refreshCurrentBtn.disabled=false; newCardBtn.disabled=true; searchInput.disabled=true; searchInput.value='';
      renderBoards(); listsListEl.innerHTML='<span class="muted">Carregando listas...</span>';
      cardsListEl.innerHTML='<div class="empty-state"><div class="empty-icon">▤</div><h3>Escolha uma lista</h3><p>As demandas aparecerão aqui.</p></div>';
      showEmptyDetail(); updateMetrics();
      await Promise.all([loadLists(board.id),loadBoardMembers(board.id),loadBoardLabels(board.id)]); updateMetrics();
    };
    boardsListEl.appendChild(item);
  });
}
function renderLists(){
  clearEl(listsListEl);
  if(!lists.length){listsListEl.innerHTML='<span class="muted">Nenhuma lista encontrada.</span>';return;}
  lists.forEach(list=>{
    const item=document.createElement('button'); item.className=`list-tab ${currentList?.id===list.id?'active':''}`; item.textContent=list.name;
    item.onclick=async()=>{
      currentList=list; currentCard=null; currentListNameEl.textContent=list.name; newCardBtn.disabled=false; searchInput.disabled=false; searchInput.value='';
      renderLists(); cardsListEl.innerHTML='<div class="empty-state"><p>Carregando demandas...</p></div>'; showEmptyDetail(); await loadCards(list.id); updateMetrics();
    };
    listsListEl.appendChild(item);
  });
}
function renderCards(sourceCards){
  clearEl(cardsListEl); updateMetrics();
  if(!sourceCards.length){cardsListEl.innerHTML='<div class="empty-state"><div class="empty-icon">＋</div><h3>Nenhuma demanda</h3><p>Crie a primeira demanda desta lista.</p></div>';return;}
  sourceCards.forEach(card=>{
    const row=document.createElement('div'); row.className='card-row';
    row.innerHTML=`<div class="card-main"><div class="card-title">${escapeHtml(card.name)}</div><div class="card-desc">${escapeHtml(card.desc||'Sem descrição')}</div></div><div class="label-list">${renderLabelsInline(card.labels||[])||'<span class="muted">—</span>'}</div><div class="date-cell">${fmtDate(card.dateLastActivity)}</div><div class="row-actions"><button class="row-btn edit" title="Editar">✎</button><button class="row-btn danger delete" title="Excluir">⌫</button></div>`;
    const open=async()=>{currentCard=card; await openCardDetail(card.id)};
    row.querySelector('.card-main').onclick=open; row.querySelector('.edit').onclick=open;
    row.querySelector('.delete').onclick=async(e)=>{e.stopPropagation();await deleteCard(card)};
    cardsListEl.appendChild(row);
  });
}
function renderBoardMembersOptions(){
  newCardMembers.innerHTML = '';
  detailMembers.innerHTML = '';

  boardMembers.forEach(member=>{
    const label = `${member.fullName} (@${member.username})`;

    const opt1 = document.createElement('option');
    opt1.value = member.id;
    opt1.textContent = label;
    newCardMembers.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = member.id;
    opt2.textContent = label;
    detailMembers.appendChild(opt2);
  });
}

function renderBoardLabelsOptions(){
  newCardLabels.innerHTML = '';
  detailLabels.innerHTML = '';

  boardLabels.forEach(label=>{
    const text = label.name ? `${label.name} (${label.color || 'sem cor'})` : (label.color || 'sem nome');

    const opt1 = document.createElement('option');
    opt1.value = label.id;
    opt1.textContent = text;
    newCardLabels.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = label.id;
    opt2.textContent = text;
    detailLabels.appendChild(opt2);
  });
}

/************** DETAIL PANEL **************/
async function openCardDetail(cardId){
  showDetailPanel();

  detailContextEl.textContent = 'Carregando card...';
  detailTitle.value = '';
  detailDesc.value = '';
  attachmentsList.innerHTML = '';
  commentsList.innerHTML = '';

  const [card, attachments, comments] = await Promise.all([
    fetch(TRELLO(`cards/${cardId}`, {
      fields:'name,desc,idMembers,idLabels,shortUrl,dateLastActivity,idBoard,idList'
    })).then(r=>r.json()),
    fetch(TRELLO(`cards/${cardId}/attachments`, {
      fields:'name,url,date'
    })).then(r=>r.json()),
    fetch(TRELLO(`cards/${cardId}/actions`, {
      filter:'commentCard',
      fields:'data,date,memberCreator'
    })).then(r=>r.json())
  ]);

  currentCard = { ...currentCard, ...card };

  detailContextEl.textContent = currentCard.name || 'Card';
  detailTitle.value = card.name || '';
  detailDesc.value = card.desc || '';
  openTrelloLink.href = card.shortUrl || '#';

  setMultiSelectValues(detailMembers, card.idMembers || []);
  setMultiSelectValues(detailLabels, card.idLabels || []);

  renderAttachments(attachments);
  renderComments(comments);
}

function renderAttachments(attachments){
  clearEl(attachmentsList);

  if(!attachments.length){
    attachmentsList.innerHTML = `<div class="attachment-item">Nenhum anexo.</div>`;
    return;
  }

  attachments.forEach(att=>{
    const row = document.createElement('div');
    row.className = 'attachment-item';
    row.innerHTML = `
      <div><a href="${att.url}" target="_blank" rel="noopener">${escapeHtml(att.name || 'Arquivo')}</a></div>
      <div class="attachment-meta">Enviado em ${fmtDate(att.date)}</div>
    `;
    attachmentsList.appendChild(row);
  });
}

function renderComments(comments){
  clearEl(commentsList);

  if(!comments.length){
    commentsList.innerHTML = `<div class="comment-item">Nenhum comentário.</div>`;
    return;
  }

  comments.forEach(comment=>{
    const row = document.createElement('div');
    row.className = 'comment-item';
    row.innerHTML = `
      <div class="comment-text">${escapeHtml(comment.data?.text || '')}</div>
      <div class="comment-meta">${escapeHtml(comment.memberCreator?.fullName || 'Alguém')} • ${fmtDate(comment.date)}</div>
    `;
    commentsList.appendChild(row);
  });
}

/************** SAVE CARD **************/
saveCardBtn.addEventListener('click', async ()=>{
  if(!currentCard?.id) return;

  const name = detailTitle.value.trim();
  if(!name){
    alert('Informe o nome do card.');
    return;
  }

  const desc = detailDesc.value;
  const idMembers = selectedValues(detailMembers).join(',');
  const idLabels = selectedValues(detailLabels).join(',');

  const res = await fetch(TRELLO(`cards/${currentCard.id}`, {
    name,
    desc,
    idMembers,
    idLabels
  }), { method:'PUT' });

  if(!res.ok){
    alert('Erro ao salvar card.');
    return;
  }

  await loadCards(currentList.id);
  await openCardDetail(currentCard.id);
  toast('Demanda atualizada com sucesso.');
});

/************** COMMENTS **************/
sendCommentBtn.addEventListener('click', async ()=>{
  if(!currentCard?.id) return;

  const text = newCommentText.value.trim();
  if(!text){
    alert('Digite um comentário.');
    return;
  }

  const res = await fetch(TRELLO(`cards/${currentCard.id}/actions/comments`, {
    text
  }), { method:'POST' });

  if(!res.ok){
    alert('Erro ao enviar comentário.');
    return;
  }

  newCommentText.value = '';
  await openCardDetail(currentCard.id);
});

/************** ATTACHMENTS **************/
uploadAttachmentsBtn.addEventListener('click', async ()=>{
  if(!currentCard?.id) return;

  const files = Array.from(detailAttachInput.files || []);
  if(!files.length){
    alert('Selecione ao menos um arquivo.');
    return;
  }

  for(const file of files){
    const form = new FormData();
    form.append('file', file, file.name);

    await fetch(TRELLO(`cards/${currentCard.id}/attachments`), {
      method:'POST',
      body:form
    });
  }

  detailAttachInput.value = '';
  await openCardDetail(currentCard.id);
  toast('Arquivo(s) anexado(s).');
});

/************** MOVE CARD **************/
moveCardBtn.addEventListener('click', async ()=>{
  if(!currentCard?.id) return;
  await openMoveDialog();
});

async function openMoveDialog(){
  const overlay = document.createElement('div');
  overlay.className = 'modal';

  overlay.innerHTML = `
    <div class="modal-content">
      <button class="icon-btn modal-close" id="moveModalClose">✕</button>
      <h3>Mover Card</h3>

      <div class="form-row">
        <label for="moveBoardSelect">Quadro</label>
        <select id="moveBoardSelect"></select>
      </div>

      <div class="form-row">
        <label for="moveListSelect">Lista</label>
        <select id="moveListSelect"></select>
      </div>

      <div class="modal-footer">
        <button id="confirmMoveBtn" class="btn primary">Mover</button>
        <button id="cancelMoveBtn" class="btn">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const moveBoardSelect = overlay.querySelector('#moveBoardSelect');
  const moveListSelect = overlay.querySelector('#moveListSelect');
  const confirmMoveBtn = overlay.querySelector('#confirmMoveBtn');
  const cancelMoveBtn = overlay.querySelector('#cancelMoveBtn');
  const moveModalClose = overlay.querySelector('#moveModalClose');

  function closeMoveModal(){
    overlay.remove();
  }

  moveModalClose.onclick = closeMoveModal;
  cancelMoveBtn.onclick = closeMoveModal;

  boards.forEach(board=>{
    const opt = document.createElement('option');
    opt.value = board.id;
    opt.textContent = board.name;
    if(board.id === currentBoard?.id) opt.selected = true;
    moveBoardSelect.appendChild(opt);
  });

  async function fillLists(boardId){
    moveListSelect.innerHTML = '';
    const res = await fetch(TRELLO(`boards/${boardId}/lists`, {
      filter:'open',
      fields:'name'
    }));
    const targetLists = await res.json();

    targetLists.forEach(list=>{
      const opt = document.createElement('option');
      opt.value = list.id;
      opt.textContent = list.name;
      if(boardId === currentBoard?.id && list.id === currentList?.id) opt.selected = true;
      moveListSelect.appendChild(opt);
    });
  }

  await fillLists(moveBoardSelect.value);

  moveBoardSelect.addEventListener('change', async ()=>{
    await fillLists(moveBoardSelect.value);
  });

  confirmMoveBtn.onclick = async ()=>{
    const idBoard = moveBoardSelect.value;
    const idList = moveListSelect.value;

    const res = await fetch(TRELLO(`cards/${currentCard.id}`, {
      idBoard,
      idList
    }), { method:'PUT' });

    if(!res.ok){
      alert('Erro ao mover card.');
      return;
    }

    closeMoveModal();

    if(idBoard !== currentBoard?.id){
      currentCard = null;
      showEmptyDetail();
      await Promise.all([
        loadLists(currentBoard.id),
        loadCards(currentList.id)
      ]);
    } else {
      await loadCards(currentList.id);
      showEmptyDetail();
    }

    toast('Demanda movida com sucesso.');
  };
}

/************** DETAIL CLOSE **************/
closeDetailBtn.addEventListener('click', ()=>{
  showEmptyDetail();
  renderCards(cards);
});

/************** REFRESH **************/
refreshCurrentBtn.addEventListener('click', async ()=>{
  if(currentBoard && !currentList){
    await Promise.all([
      loadLists(currentBoard.id),
      loadBoardMembers(currentBoard.id),
      loadBoardLabels(currentBoard.id)
    ]);
    return;
  }

  if(currentBoard && currentList){
    await Promise.all([
      loadCards(currentList.id),
      loadBoardMembers(currentBoard.id),
      loadBoardLabels(currentBoard.id)
    ]);

    if(currentCard?.id){
      await openCardDetail(currentCard.id);
    }
  }
});

/************** SEARCH **************/
searchInput.addEventListener('input', ()=>{
  const term = searchInput.value.toLowerCase().trim();

  if(!term){
    renderCards(cards);
    return;
  }

  const filtered = cards.filter(card=>{
    const inName = (card.name || '').toLowerCase().includes(term);
    const inDesc = (card.desc || '').toLowerCase().includes(term);
    const inLabels = (card.labels || []).some(lb => ((lb.name || lb.color || '').toLowerCase().includes(term)));
    return inName || inDesc || inLabels;
  });

  renderCards(filtered);
});

/************** NEW CARD MODAL **************/
function openNewCardModal(){
  newCardModal.classList.remove('hidden');
  newCardFeedback.textContent = '';
  newCardFeedback.className = 'feedback';
  newCardTitle.value = '';
  newCardDescription.value = '';
  newCardFiles = [];
  renderNewCardFiles();
  setMultiSelectValues(newCardMembers, []);
  setMultiSelectValues(newCardLabels, []);
}

function closeNewCardModal(){
  newCardModal.classList.add('hidden');
  newCardTitle.value = '';
  newCardDescription.value = '';
  newCardFiles = [];
  renderNewCardFiles();
  newCardFeedback.textContent = '';
  newCardFeedback.className = 'feedback';
}

newCardBtn.addEventListener('click', ()=>{
  if(!currentList?.id) return;
  openNewCardModal();
});

closeNewCardModalBtn.addEventListener('click', closeNewCardModal);
cancelNewCardBtn.addEventListener('click', closeNewCardModal);

/************** NEW CARD FILES **************/
function renderNewCardFiles(){
  clearEl(newCardFilesPreview);

  if(!newCardFiles.length){
    newCardFilesPreview.innerHTML = `<div class="item-sub">Nenhum arquivo selecionado.</div>`;
    return;
  }

  newCardFiles.forEach((file, idx)=>{
    const row = document.createElement('div');
    row.className = 'file-preview-item';
    row.innerHTML = `
      <span>${escapeHtml(file.name)}</span>
      <span class="file-remove">✕</span>
    `;
    row.querySelector('.file-remove').onclick = ()=>{
      newCardFiles.splice(idx, 1);
      renderNewCardFiles();
    };
    newCardFilesPreview.appendChild(row);
  });
}

newCardDropZone.addEventListener('click', ()=> newCardFileInput.click());

newCardFileInput.addEventListener('change', e=>{
  const files = Array.from(e.target.files || []);
  newCardFiles.push(...files);
  renderNewCardFiles();
  newCardFileInput.value = '';
});

['dragenter','dragover'].forEach(evt=>{
  newCardDropZone.addEventListener(evt, e=>{
    e.preventDefault();
    newCardDropZone.classList.add('dragover');
  });
});

['dragleave','drop'].forEach(evt=>{
  newCardDropZone.addEventListener(evt, e=>{
    e.preventDefault();
    newCardDropZone.classList.remove('dragover');
  });
});

newCardDropZone.addEventListener('drop', e=>{
  const files = Array.from(e.dataTransfer.files || []);
  newCardFiles.push(...files);
  renderNewCardFiles();
});

/************** CREATE CARD **************/
createCardBtn.addEventListener('click', async ()=>{
  if(!currentList?.id){
    newCardFeedback.textContent = 'Selecione uma lista.';
    newCardFeedback.className = 'feedback error';
    return;
  }

  const name = newCardTitle.value.trim();
  if(!name){
    newCardFeedback.textContent = 'Informe o nome do card.';
    newCardFeedback.className = 'feedback error';
    return;
  }

  const desc = newCardDescription.value;
  const idMembers = selectedValues(newCardMembers).join(',');
  const idLabels = selectedValues(newCardLabels).join(',');

  const res = await fetch(TRELLO('cards', {
    idList: currentList.id,
    name,
    desc,
    idMembers,
    idLabels,
    pos:'top'
  }), { method:'POST' });

  if(!res.ok){
    newCardFeedback.textContent = 'Erro ao criar card.';
    newCardFeedback.className = 'feedback error';
    return;
  }

  const createdCard = await res.json();

  for(const file of newCardFiles){
    const form = new FormData();
    form.append('file', file, file.name);

    await fetch(TRELLO(`cards/${createdCard.id}/attachments`), {
      method:'POST',
      body:form
    });
  }

  newCardFeedback.innerHTML = `✅ Card criado. <a href="${createdCard.shortUrl}" target="_blank" rel="noopener">Abrir</a>`;
  newCardFeedback.className = 'feedback success';

  await loadCards(currentList.id);
  setTimeout(closeNewCardModal, 900);
});

/************** DELETE CARD **************/
async function deleteCard(card=currentCard){
  if(!card?.id) return;
  if(!confirm(`Excluir a demanda "${card.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
  const res=await fetch(TRELLO(`cards/${card.id}`),{method:'DELETE'});
  if(!res.ok){toast('Não foi possível excluir a demanda.',true);return;}
  if(currentCard?.id===card.id) showEmptyDetail();
  await loadCards(currentList.id); toast('Demanda excluída.');
}
document.getElementById('deleteCardBtn')?.addEventListener('click',()=>deleteCard(currentCard));
document.getElementById('drawerBackdrop')?.addEventListener('click',showEmptyDetail);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){showEmptyDetail(); if(!newCardModal.classList.contains('hidden')) closeNewCardModal();}});

/************** START **************/
(async function init(){
  try{
    await loadBoards();
    showEmptyDetail(); updateMetrics();
  }catch(err){
    console.error(err);
    boardsListEl.innerHTML = `<div class="empty-pane"><p>Erro ao carregar dados do Trello.</p></div>`;
  }
})();
