/************** CONFIG **************/
const apiKey  = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken= "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

/************** DOM **************/
const boardSelect = document.getElementById('boardSelect');
const listSelect  = document.getElementById('listSelect');
const refreshBtn  = document.getElementById('refreshCards');
const openCreateModalBtn = document.getElementById('openCreateModal');

const cardsListEl = document.getElementById('cardsList');
const cardDetailsEl = document.getElementById('cardDetails');
const searchSection = document.getElementById('searchSection');
const searchInput = document.getElementById('searchInput');

const createModal = document.getElementById('createModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const cancelCreate = document.getElementById('cancelCreate');
const createCardBtn = document.getElementById('createCardBtn');

const newCardName = document.getElementById('newCardName');
const newCardDesc = document.getElementById('newCardDesc');
const newCardMembers = document.getElementById('newCardMembers');
const newCardLabels  = document.getElementById('newCardLabels');

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const pickFiles = document.getElementById('pickFiles');
const previewList = document.getElementById('previewList');
const createFeedback = document.getElementById('createFeedback');

const cardItemTpl = document.getElementById('cardItemTpl');
const labelPillTpl = document.getElementById('labelPillTpl');

/************** STATE **************/
let boards = [];
let listsByBoard = new Map();
let currentBoard = null;
let currentList = null;
let boardMembers = [];
let boardLabels  = [];
let attachmentsToUpload = [];
let allCards = [];

/************** HELPERS **************/
const TRELLO = (path, params={}) => {
  const url = new URL(`https://api.trello.com/1/${path}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', apiToken);
  Object.entries(params).forEach(([k,v])=> url.searchParams.set(k, v));
  return url.toString();
};
function fmtDate(s){ if(!s) return '—'; const d=new Date(s); return d.toLocaleString(); }
function el(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}
function clearChildren(e){while(e.firstChild)e.removeChild(e.firstChild);}

/************** INIT **************/
async function loadBoards(){
  const res = await fetch(TRELLO('members/me/boards',{fields:'name,url,closed',filter:'open'}));
  boards = await res.json();
  boardSelect.innerHTML = `<option value="">Selecione um quadro...</option>`;
  boards.forEach(b=>{
    const opt=document.createElement('option');
    opt.value=b.id; opt.textContent=b.name;
    boardSelect.appendChild(opt);
  });
}

async function loadLists(boardId){
  const res=await fetch(TRELLO(`boards/${boardId}/lists`,{cards:'none',filter:'open'}));
  const lists=await res.json();
  listsByBoard.set(boardId,lists);
  listSelect.innerHTML=`<option value="">Selecione uma lista...</option>`;
  lists.forEach(l=>{
    const opt=document.createElement('option');
    opt.value=l.id; opt.textContent=l.name;
    listSelect.appendChild(opt);
  });
  listSelect.disabled=false;
  refreshBtn.disabled=true;
  openCreateModalBtn.disabled=false;
}

async function loadBoardMembers(boardId){
  const res=await fetch(TRELLO(`boards/${boardId}/members`,{fields:'fullName,username'}));
  boardMembers=await res.json();
  newCardMembers.innerHTML='';
  boardMembers.forEach(m=>{
    const opt=document.createElement('option');
    opt.value=m.id;
    opt.textContent=`${m.fullName} (@${m.username})`;
    newCardMembers.appendChild(opt);
  });
}

async function loadBoardLabels(boardId){
  const res=await fetch(TRELLO(`boards/${boardId}/labels`,{fields:'name,color',limit:1000}));
  boardLabels=await res.json();
  newCardLabels.innerHTML='';
  boardLabels.forEach(lb=>{
    const opt=document.createElement('option');
    opt.value=lb.id;
    opt.textContent=lb.name?`${lb.name} (${lb.color||'sem cor'})`:(lb.color||'sem nome');
    newCardLabels.appendChild(opt);
  });
}

/************** CARDS **************/
async function loadCards(listId){
  const res=await fetch(TRELLO(`lists/${listId}/cards`,{
    fields:'name,desc,idLabels,idMembers,shortLink,dateLastActivity,labels'
  }));
  allCards=await res.json();
  renderCards(allCards);
  searchSection.style.display='block';
}

function renderCards(cards){
  clearChildren(cardsListEl);
  cardsListEl.classList.remove('empty-state');
  if(!cards.length){
    cardsListEl.classList.add('empty-state');
    cardsListEl.innerHTML=`<p>Nenhum card nesta lista.</p>`;
    return;
  }
  cards.forEach(card=>{
    const node=cardItemTpl.content.cloneNode(true);
    node.querySelector('.card-title').textContent=card.name;
    const labelList=node.querySelector('.label-list');
    card.labels?.forEach(lb=>{
      const pill=labelPillTpl.content.cloneNode(true);
      pill.querySelector('.label-pill').textContent=lb.name||lb.color||'Etiqueta';
      labelList.appendChild(pill);
    });
    node.querySelector('.view-details').addEventListener('click',()=>showCardDetails(card.id));
    node.querySelector('.move-card').addEventListener('click',()=>openMoveDialog(card));
    cardsListEl.appendChild(node);
  });
}

/************** 🔍 BUSCA EM TEMPO REAL **************/
searchInput?.addEventListener('input',()=>{
  const q=searchInput.value.toLowerCase().trim();
  if(!q){renderCards(allCards);return;}
  const filtered=allCards.filter(c=>{
    const inName=c.name?.toLowerCase().includes(q);
    const inDesc=c.desc?.toLowerCase().includes(q);
    const inLabel=c.labels?.some(lb=>(lb.name||lb.color||'').toLowerCase().includes(q));
    const inMember=c.idMembers?.some(id=>{
      const m=boardMembers.find(mm=>mm.id===id);
      return m && (m.fullName.toLowerCase().includes(q)||m.username.toLowerCase().includes(q));
    });
    return inName||inDesc||inLabel||inMember;
  });
  renderCards(filtered);
});

/************** DETALHES / CRIAÇÃO / MOVIMENTAÇÃO **************/
async function showCardDetails(id){
  const [cRes,mRes,aRes,comRes,actRes]=await Promise.all([
    fetch(TRELLO(`cards/${id}`,{fields:'name,desc,shortUrl,idBoard,idList,labels,dateLastActivity'})),
    fetch(TRELLO(`cards/${id}/members`)),
    fetch(TRELLO(`cards/${id}/attachments`)),
    fetch(TRELLO(`cards/${id}/actions`,{filter:'commentCard'})),
    fetch(TRELLO(`cards/${id}/actions`,{filter:'createCard,updateCard,moveCardToBoard,updateCard:idList'}))
  ]);
  const c=await cRes.json();
  const mem=await mRes.json();
  const att=await aRes.json();
  const com=await comRes.json();
  const act=await actRes.json();

  cardDetailsEl.classList.remove('hidden');
  clearChildren(cardDetailsEl);
  const h2=el('h2');h2.textContent=c.name;
  const link=el('a');link.href=c.shortUrl;link.textContent='Abrir no Trello ↗';link.target='_blank';
  const meta=el('div','muted');meta.textContent=`Última atividade: ${fmtDate(c.dateLastActivity)}`;
  cardDetailsEl.append(h2,link,meta);

  const desc=el('div','info-block');
  desc.innerHTML=`<h3>Descrição</h3><div>${c.desc||'—'}</div>`;
  cardDetailsEl.appendChild(desc);

  const mdiv=el('div','info-block');
  mdiv.innerHTML='<h3>Membros</h3>';
  if(mem.length) mem.forEach(m=>mdiv.innerHTML+=`<span class="pill">${m.fullName}</span>`);
  else mdiv.innerHTML+='<div>—</div>';
  cardDetailsEl.appendChild(mdiv);

  const ldiv=el('div','info-block');
  ldiv.innerHTML='<h3>Etiquetas</h3>';
  if(c.labels.length) c.labels.forEach(lb=>ldiv.innerHTML+=`<span class="pill">${lb.name||lb.color}</span>`);
  else ldiv.innerHTML+='<div>—</div>';
  cardDetailsEl.appendChild(ldiv);
}

/************** MODAL **************/
function openCreateModal(){
  createModal.classList.remove('hidden');
  createFeedback.textContent='';
  newCardName.value=''; newCardDesc.value='';
  attachmentsToUpload=[];
  renderPreviews();
  // 🔧 Corrigido: recarregar etiquetas antes de abrir
  if(currentBoard) loadBoardLabels(currentBoard.id);
}
function closeCreate(){createModal.classList.add('hidden');}
cancelCreate.addEventListener('click',closeCreate);
closeCreateModal.addEventListener('click',closeCreate);
openCreateModalBtn.addEventListener('click',openCreateModal);

/************** CRIAR CARD **************/
async function createCard(){
  createFeedback.textContent='';
  if(!currentList){createFeedback.textContent='Selecione uma lista.';return;}
  const name=newCardName.value.trim();
  if(!name){createFeedback.textContent='Informe o nome do card.';return;}
  const desc=newCardDesc.value.trim();
  const idMembers=Array.from(newCardMembers.selectedOptions).map(o=>o.value);
  const idLabels=Array.from(newCardLabels.selectedOptions).map(o=>o.value);
  const res=await fetch(TRELLO('cards',{
    idList:currentList.id,name,desc,
    idMembers:idMembers.join(','),idLabels:idLabels.join(','),pos:'top'
  }),{method:'POST'});
  const card=await res.json();
  if(!res.ok){createFeedback.textContent='Erro ao criar card.';return;}
  for(const it of attachmentsToUpload){
    const form=new FormData();form.append('file',it.file,it.name);
    await fetch(TRELLO(`cards/${card.id}/attachments`),{method:'POST',body:form});
  }
  createFeedback.innerHTML=`✅ Card criado! <a href="${card.shortUrl}" target="_blank">Abrir</a>`;
  createFeedback.classList.add('success');
  loadCards(currentList.id);
  setTimeout(closeCreate,1000);
}
createCardBtn.addEventListener('click',createCard);

/************** ANEXOS **************/
function renderPreviews(){
  clearChildren(previewList);
  if(!attachmentsToUpload.length){
    previewList.innerHTML='<div class="muted">Nenhum anexo.</div>';return;
  }
  attachmentsToUpload.forEach((item,idx)=>{
    const box=el('div','preview-item');
    const name=el('div','preview-name');name.textContent=item.name;
    const rm=el('span','preview-remove');rm.textContent='Remover';
    rm.addEventListener('click',()=>{attachmentsToUpload.splice(idx,1);renderPreviews();});
    box.append(name,rm);
    previewList.appendChild(box);
  });
}
pickFiles.addEventListener('click',()=>fileInput.click());
fileInput.addEventListener('change',e=>{
  Array.from(e.target.files).forEach(f=>attachmentsToUpload.push({file:f,name:f.name}));
  renderPreviews();
});

/************** EVENTOS **************/
boardSelect.addEventListener('change',async()=>{
  const id=boardSelect.value;
  if(!id){listSelect.disabled=true;openCreateModalBtn.disabled=true;return;}
  currentBoard=boards.find(b=>b.id===id);
  await loadLists(id);
  await loadBoardMembers(id);
  await loadBoardLabels(id);
});
listSelect.addEventListener('change',async()=>{
  const id=listSelect.value;
  if(!id){refreshBtn.disabled=true;return;}
  currentList=(listsByBoard.get(currentBoard.id)||[]).find(l=>l.id===id);
  refreshBtn.disabled=false;
  await loadCards(id);
});
refreshBtn.addEventListener('click',()=>{if(currentList)loadCards(currentList.id);});

/************** BOOT **************/
loadBoards();
