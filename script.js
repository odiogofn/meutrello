const apiKey="4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken="ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

const boardSelect=document.getElementById('boardSelect');
const listSelect=document.getElementById('listSelect');
const refreshBtn=document.getElementById('refreshCards');
const openCreateModalBtn=document.getElementById('openCreateModal');
const cardsListEl=document.getElementById('cardsList');
const cardDetailsEl=document.getElementById('cardDetails');
const searchSection=document.getElementById('searchSection');
const searchInput=document.getElementById('searchInput');
const createModal=document.getElementById('createModal');
const closeCreateModal=document.getElementById('closeCreateModal');
const cancelCreate=document.getElementById('cancelCreate');
const createCardBtn=document.getElementById('createCardBtn');
const newCardName=document.getElementById('newCardName');
const newCardDesc=document.getElementById('newCardDesc');
const newCardMembers=document.getElementById('newCardMembers');
const newCardLabels=document.getElementById('newCardLabels');
const fileInput=document.getElementById('fileInput');
const pickFiles=document.getElementById('pickFiles');
const previewList=document.getElementById('previewList');
const createFeedback=document.getElementById('createFeedback');
const cardItemTpl=document.getElementById('cardItemTpl');
const labelPillTpl=document.getElementById('labelPillTpl');

let boards=[],listsByBoard=new Map(),currentBoard=null,currentList=null;
let boardMembers=[],boardLabels=[],allCards=[],attachmentsToUpload=[];

const TRELLO=(p,params={})=>{
  const u=new URL(`https://api.trello.com/1/${p}`);
  u.searchParams.set('key',apiKey);u.searchParams.set('token',apiToken);
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
  boards.forEach(b=>{const o=el('option');o.value=b.id;o.textContent=b.name;boardSelect.append(o);});
}
async function loadLists(id){
  const r=await fetch(TRELLO(`boards/${id}/lists`,{filter:'open'}));
  const l=await r.json();listsByBoard.set(id,l);
  listSelect.innerHTML='<option value="">Selecione uma lista...</option>';
  l.forEach(x=>{const o=el('option');o.value=x.id;o.textContent=x.name;listSelect.append(o);});
  listSelect.disabled=false;openCreateModalBtn.disabled=false;
}
async function loadBoardMembers(id){
  const r=await fetch(TRELLO(`boards/${id}/members`,{fields:'fullName,username'}));
  boardMembers=await r.json();
  newCardMembers.innerHTML='';
  boardMembers.forEach(m=>{const o=el('option');o.value=m.id;o.textContent=`${m.fullName} (@${m.username})`;newCardMembers.append(o);});
}
async function loadBoardLabels(id){
  const r=await fetch(TRELLO(`boards/${id}/labels`,{fields:'name,color'}));
  boardLabels=await r.json();
  newCardLabels.innerHTML='';
  boardLabels.forEach(l=>{const o=el('option');o.value=l.id;o.textContent=l.name||l.color;newCardLabels.append(o);});
}

/************** LOAD CARDS **************/
async function loadCards(id){
  const r=await fetch(TRELLO(`lists/${id}/cards`,{fields:'name,desc,labels,idMembers,dateLastActivity'}));
  allCards=await r.json();renderCards(allCards);searchSection.style.display='block';
}
function renderCards(cards){
  clearChildren(cardsListEl);
  if(!cards.length){cardsListEl.innerHTML='<p>Nenhum card.</p>';return;}
  cards.forEach(c=>{
    const node=cardItemTpl.content.cloneNode(true);
    node.querySelector('.card-title').textContent=c.name;
    const labelList=node.querySelector('.label-list');
    c.labels?.forEach(l=>{const p=labelPillTpl.content.cloneNode(true);p.querySelector('.label-pill').textContent=l.name||l.color;labelList.append(p);});
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

/************** CARD DETAILS + COMENTÁRIOS **************/
async function showCardDetails(id){
  const [c,m,a,com]=await Promise.all([
    fetch(TRELLO(`cards/${id}`,{fields:'name,desc,labels,shortUrl,dateLastActivity'})).then(r=>r.json()),
    fetch(TRELLO(`cards/${id}/members`)).then(r=>r.json()),
    fetch(TRELLO(`cards/${id}/attachments`)).then(r=>r.json()),
    fetch(TRELLO(`cards/${id}/actions`,{filter:'commentCard'})).then(r=>r.json())
  ]);
  cardDetailsEl.classList.remove('hidden');clearChildren(cardDetailsEl);

  const h2=el('h2');h2.textContent=c.name;
  const meta=el('div','muted');meta.textContent=`Última atividade: ${fmtDate(c.dateLastActivity)}`;
  cardDetailsEl.append(h2,meta);
  cardDetailsEl.innerHTML+=`<div class="info-block"><h3>Descrição</h3><div>${c.desc||'—'}</div></div>`;

  const mem=el('div','info-block');mem.innerHTML='<h3>Membros</h3>';
  m.length?m.forEach(x=>mem.innerHTML+=`<span class="pill">${x.fullName}</span>`):mem.innerHTML+='<div>—</div>';
  cardDetailsEl.append(mem);

  const lbs=el('div','info-block');lbs.innerHTML='<h3>Etiquetas</h3>';
  c.labels.length?c.labels.forEach(l=>lbs.innerHTML+=`<span class="pill">${l.name||l.color}</span>`):lbs.innerHTML+='<div>—</div>';
  cardDetailsEl.append(lbs);

  const att=el('div','info-block');att.innerHTML='<h3>Anexos</h3>';
  const attList=el('div');
  a.length?a.forEach(x=>attList.innerHTML+=`<div class="attachment"><a href="${x.url}" target="_blank">${x.name}</a></div>`):attList.innerHTML='<div>—</div>';
  att.append(attList);cardDetailsEl.append(att);

  const coms=el('div','info-block');coms.innerHTML='<h3>Comentários</h3>';
  const comList=el('div');
  com.length?com.forEach(ca=>comList.innerHTML+=`<div class="history-item"><b>${ca.memberCreator.fullName}:</b> ${ca.data.text}</div>`):comList.innerHTML='<div>—</div>';
  coms.append(comList);cardDetailsEl.append(coms);

  const add=el('div','info-block');
  add.innerHTML=`
    <h3>Adicionar comentário / imagem</h3>
    <textarea id="newComment" rows="3" placeholder="Escreva um comentário ou cole uma imagem..."></textarea>
    <div id="commentPreview" class="preview-list"></div>
    <button id="sendComment" class="btn primary" style="margin-top:6px;">Enviar</button>
  `;
  cardDetailsEl.append(add);

  const commentBox=document.getElementById('newComment');
  const sendBtn=document.getElementById('sendComment');
  const preview=document.getElementById('commentPreview');
  let commentImages=[];

  function renderCommentPreviews(){
    clearChildren(preview);
    if(!commentImages.length){
      preview.innerHTML='<div class="muted">Nenhuma imagem adicionada.</div>';return;
    }
    commentImages.forEach((item,idx)=>{
      const wrap=el('div','preview-item');
      const img=el('img');img.src=item.url;img.style.maxWidth='100px';
      const rm=el('span','preview-remove');rm.textContent='Remover';
      rm.onclick=()=>{commentImages.splice(idx,1);renderCommentPreviews();};
      wrap.append(img,rm);preview.append(wrap);
    });
  }

  commentBox.addEventListener('paste',e=>{
    const items=e.clipboardData.items;
    for(const it of items){
      if(it.type.indexOf('image')!==-1){
        const file=it.getAsFile();
        const reader=new FileReader();
        reader.onload=()=>{commentImages.push({file,url:reader.result});renderCommentPreviews();};
        reader.readAsDataURL(file);
      }
    }
  });
  commentBox.addEventListener('dragover',e=>e.preventDefault());
  commentBox.addEventListener('drop',e=>{
    e.preventDefault();
    for(const f of e.dataTransfer.files){
      if(f.type.startsWith('image/')){
        const r=new FileReader();
        r.onload=()=>{commentImages.push({file:f,url:r.result});renderCommentPreviews();};
        r.readAsDataURL(f);
      }
    }
  });

  sendBtn.onclick=async()=>{
    const txt=commentBox.value.trim();
    if(!txt && !commentImages.length)return alert('Digite um comentário ou adicione uma imagem.');
    if(txt){
      await fetch(TRELLO(`cards/${id}/actions/comments`,{text:txt}),{method:'POST'});
      const d=el('div','history-item');d.innerHTML=`<b>Você:</b> ${txt}`;comList.append(d);
      commentBox.value='';
    }
    for(const img of commentImages){
      const form=new FormData();form.append('file',img.file,'imagem.png');
      await fetch(TRELLO(`cards/${id}/attachments`),{method:'POST',body:form});
      attList.innerHTML+=`<div class="attachment"><a href="#" target="_blank">[Nova imagem]</a></div>`;
    }
    commentImages=[];renderCommentPreviews();
  };
}

/************** BOTÃO MOVER **************/
async function openMoveDialog(card){
  const modal=document.createElement('div');
  modal.className='modal-overlay';
  modal.innerHTML=`
    <div class="modal-content" style="max-width:400px;">
      <h3>Mover "${card.name}"</h3>
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
  document.body.append(modal);

  const moveBoard=document.getElementById('moveBoard');
  const moveList=document.getElementById('moveList');
  const confirm=document.getElementById('confirmMove');
  const cancel=document.getElementById('cancelMove');

  boards.forEach(b=>{
    const o=document.createElement('option');o.value=b.id;o.textContent=b.name;
    if(b.id===currentBoard.id)o.selected=true;
    moveBoard.append(o);
  });

  async function loadMoveLists(boardId){
    const res=await fetch(TRELLO(`boards/${boardId}/lists`,{filter:'open'}));
    const lists=await res.json();
    moveList.innerHTML='';
    lists.forEach(l=>{
      const o=document.createElement('option');
      o.value=l.id;o.textContent=l.name;
      if(boardId===currentBoard.id && l.id===currentList.id)o.selected=true;
      moveList.append(o);
    });
  }

  await loadMoveLists(moveBoard.value);
  moveBoard.onchange=()=>loadMoveLists(moveBoard.value);

  cancel.onclick=()=>modal.remove();
  confirm.onclick=async()=>{
    const newBoard=moveBoard.value;
    const newList=moveList.value;
    await fetch(TRELLO(`cards/${card.id}`,{idBoard:newBoard,idList:newList}),{method:'PUT'});
    alert(`Card movido com sucesso!`);
    modal.remove();
    loadCards(currentList.id);
  };
}

/************** CREATE CARD **************/
function openCreateModal(){createModal.classList.remove('hidden');loadBoardLabels(currentBoard.id);}
function closeCreate(){createModal.classList.add('hidden');}
closeCreateModal.onclick=cancelCreate.onclick=closeCreate;
openCreateModalBtn.onclick=openCreateModal;
createCardBtn.onclick=createCard;

async function createCard(){
  const name=newCardName.value.trim();if(!name)return;
  const desc=newCardDesc.value.trim();
  const idMembers=Array.from(newCardMembers.selectedOptions).map(o=>o.value);
  const idLabels=Array.from(newCardLabels.selectedOptions).map(o=>o.value);
  const r=await fetch(TRELLO('cards',{idList:currentList.id,name,desc,idMembers:idMembers.join(','),idLabels:idLabels.join(',')}),{method:'POST'});
  const card=await r.json();
  if(!r.ok)return alert('Erro ao criar');
  alert('Card criado!');closeCreate();loadCards(currentList.id);
}

/************** EVENTOS **************/
boardSelect.onchange=async()=>{
  const id=boardSelect.value;if(!id)return;
  currentBoard=boards.find(b=>b.id===id);
  await loadLists(id);await loadBoardMembers(id);await loadBoardLabels(id);
};
listSelect.onchange=async()=>{
  const id=listSelect.value;if(!id)return;
  currentList=(listsByBoard.get(currentBoard.id)||[]).find(l=>l.id===id);
  await loadCards(id);
};
refreshBtn.onclick=()=>currentList&&loadCards(currentList.id);

/************** BOOT **************/
loadBoards();
