const apiKey="4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken="ATTAc15f31b2e80716400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

const boardSelect=document.getElementById('boardSelect');
const listSelect=document.getElementById('listSelect');
const refreshBtn=document.getElementById('refreshCards');
const openCreateModalBtn=document.getElementById('openCreateModal');
const createModal=document.getElementById('createModal');
const closeCreateModal=document.getElementById('closeCreateModal');
const cancelCreate=document.getElementById('cancelCreate');
const createCardBtn=document.getElementById('createCardBtn');
const newCardName=document.getElementById('newCardName');
const newCardDesc=document.getElementById('newCardDesc');
const newCardMembers=document.getElementById('newCardMembers');
const newCardLabels=document.getElementById('newCardLabels');
const previewList=document.getElementById('previewList');
const createFeedback=document.getElementById('createFeedback');
const cardsListEl=document.getElementById('cardsList');
const cardDetailsEl=document.getElementById('cardDetails');
const searchInput=document.getElementById('searchInput');
const searchSection=document.getElementById('searchSection');
const cardItemTpl=document.getElementById('cardItemTpl');
const labelPillTpl=document.getElementById('labelPillTpl');

let boards=[],listsByBoard=new Map(),currentBoard=null,currentList=null;
let boardMembers=[],boardLabels=[],allCards=[],attachmentsToUpload=[];

const TRELLO=(p,params={})=>{
  const u=new URL(`https://api.trello.com/1/${p}`);
  u.searchParams.set('key',apiKey);
  u.searchParams.set('token',apiToken);
  Object.entries(params).forEach(([k,v])=>u.searchParams.set(k,v));
  return u.toString();
};

const fmtDate=s=>new Date(s).toLocaleString();
const el=(t,c)=>{const e=document.createElement(t);if(c)e.className=c;return e;};
const clearChildren=e=>{while(e.firstChild)e.removeChild(e.firstChild);};

/************** LOAD BOARDS/LISTS/MEMBERS/LABELS **************/
async function loadBoards(){
  const r=await fetch(TRELLO('members/me/boards',{filter:'open',fields:'name'}));
  boards=await r.json();
  boardSelect.innerHTML='<option value="">Selecione um quadro...</option>';
  boards.forEach(b=>{
    const o=el('option');
    o.value=b.id;
    o.textContent=b.name;
    boardSelect.append(o);
  });
}

async function loadLists(id){
  const r=await fetch(TRELLO(`boards/${id}/lists`,{filter:'open'}));
  const l=await r.json();
  listsByBoard.set(id,l);
  listSelect.innerHTML='<option value="">Selecione uma lista...</option>';
  l.forEach(x=>{
    const o=el('option');
    o.value=x.id;
    o.textContent=x.name;
    listSelect.append(o);
  });
  listSelect.disabled=false;
  openCreateModalBtn.disabled=false;
}

async function loadBoardMembers(id){
  const r=await fetch(TRELLO(`boards/${id}/members`,{fields:'fullName,username'}));
  boardMembers=await r.json();
  newCardMembers.innerHTML='';
  boardMembers.forEach(m=>{
    const o=el('option');
    o.value=m.id;
    o.textContent=`${m.fullName} (@${m.username})`;
    newCardMembers.append(o);
  });
}

async function loadBoardLabels(id){
  const r=await fetch(TRELLO(`boards/${id}/labels`,{fields:'name,color'}));
  boardLabels=await r.json();
  newCardLabels.innerHTML='';
  boardLabels.forEach(l=>{
    const o=el('option');
    o.value=l.id;
    o.textContent=l.name||l.color;
    newCardLabels.append(o);
  });
}

/************** LOAD CARDS **************/
async function loadCards(id){
  const r=await fetch(TRELLO(`lists/${id}/cards`,{fields:'name,desc,labels,idMembers,dateLastActivity'}));
  allCards=await r.json();
  renderCards(allCards);
  searchSection.style.display='block';
}

function renderCards(cards){
  clearChildren(cardsListEl);
  if(!cards.length){
    cardsListEl.innerHTML='<p>Nenhum card encontrado.</p>';
    return;
  }
  cards.forEach(c=>{
    const node=cardItemTpl.content.cloneNode(true);
    node.querySelector('.card-title').textContent=c.name;
    const labelList=node.querySelector('.label-list');
    c.labels?.forEach(l=>{
      const p=labelPillTpl.content.cloneNode(true);
      p.querySelector('.label-pill').textContent=l.name||l.color;
      labelList.append(p);
    });
    node.querySelector('.view-details').onclick=()=>showCardDetails(c.id);
    node.querySelector('.move-card').onclick=()=>openMoveDialog(c);
    cardsListEl.append(node);
  });
}

/************** SEARCH **************/
searchInput.oninput=()=>{
  const q=searchInput.value.toLowerCase();
  if(!q)return renderCards(allCards);
  const f=allCards.filter(c=>{
    const inN=c.name?.toLowerCase().includes(q);
    const inD=c.desc?.toLowerCase().includes(q);
    const inL=c.labels?.some(l=>(l.name||l.color).toLowerCase().includes(q));
    const inM=c.idMembers?.some(id=>{
      const m=boardMembers.find(mm=>mm.id===id);
      return m&&(m.fullName.toLowerCase().includes(q)||m.username.toLowerCase().includes(q));
    });
    return inN||inD||inL||inM;
  });
  renderCards(f);
};

/************** CREATE MODAL **************/
function openCreateModal(){
  createModal.classList.remove('hidden');
  createFeedback.textContent='';
  newCardName.value='';
  newCardDesc.value='';
  attachmentsToUpload=[];
  previewList.innerHTML='';
  loadBoardLabels(currentBoard.id);
}

function closeCreate(){
  createModal.classList.add('hidden');
  newCardName.value='';
  newCardDesc.value='';
  attachmentsToUpload=[];
  previewList.innerHTML='';
  createFeedback.textContent='';
}

openCreateModalBtn.addEventListener('click', openCreateModal);
closeCreateModal.addEventListener('click', e=>{
  e.preventDefault();
  closeCreate();
});
cancelCreate.addEventListener('click', e=>{
  e.preventDefault();
  closeCreate();
});

/************** CREATE CARD **************/
async function createCard(e){
  e.preventDefault();
  const name=newCardName.value.trim();
  const desc=newCardDesc.value.trim();
  const idMembers=Array.from(newCardMembers.selectedOptions).map(o=>o.value);
  const idLabels=Array.from(newCardLabels.selectedOptions).map(o=>o.value);

  if(!name){
    createFeedback.textContent='⚠️ Informe o nome do card.';
    createFeedback.classList.add('error');
    return;
  }

  const r=await fetch(TRELLO('cards',{
    idList:currentList.id,
    name,
    desc,
    idMembers:idMembers.join(','),
    idLabels:idLabels.join(',')
  }),{method:'POST'});

  const card=await r.json();
  if(!r.ok){
    createFeedback.textContent='❌ Erro ao criar card.';
    return;
  }

  createFeedback.innerHTML=`✅ Card criado! <a href="${card.shortUrl}" target="_blank">Abrir</a>`;
  createFeedback.classList.add('success');
  setTimeout(()=>{closeCreate();loadCards(currentList.id);},1200);
}

createCardBtn.addEventListener('click', createCard);

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

refreshBtn.addEventListener('click',()=>{
  if(currentList)loadCards(currentList.id);
});

/************** BOOT **************/
loadBoards();
