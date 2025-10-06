/* script.js - carregamento automático + dual listboxes (membros + labels)
   criar/mover card + upload attachments (<=10MB) + exibir link do card
*/

const apiKey = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken = "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

const boardSelect = document.getElementById('boardSelect');
const listSelect = document.getElementById('listSelect');
const cardSelect = document.getElementById('cardSelect');
const posSelect = document.getElementById('posSelect');
const cardNameInput = document.getElementById('cardName');
const cardDescInput = document.getElementById('cardDesc');
const dueInput = document.getElementById('due');

const membersAvailable = document.getElementById('membersAvailable');
const membersSelected = document.getElementById('membersSelected');
const addMemberBtn = document.getElementById('addMember');
const removeMemberBtn = document.getElementById('removeMember');
const fetchMembersBtn = document.getElementById('fetchMembers');

const labelsAvailable = document.getElementById('labelsAvailable');
const labelsSelected = document.getElementById('labelsSelected');
const addLabelBtn = document.getElementById('addLabel');
const removeLabelBtn = document.getElementById('removeLabel');
const fetchLabelsBtn = document.getElementById('fetchLabels');

const attachmentsInput = document.getElementById('attachments');
const form = document.getElementById('trelloForm');
const responseBox = document.getElementById('response');
const resetBtn = document.getElementById('resetBtn');
const toggleResponse = document.getElementById('toggleResponse');

function getUrl(path){
  // adiciona key/token automaticamente
  const sep = path.includes('?') ? '&' : '?';
  return `https://api.trello.com/1${path}${sep}key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(apiToken)}`;
}

async function apiGet(path){
  const url = getUrl(path);
  const res = await fetch(url);
  if(!res.ok) {
    const text = await res.text().catch(()=>res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

async function apiPostForm(path, formData){
  const url = getUrl(path);
  const res = await fetch(url, { method: 'POST', body: formData });
  if(!res.ok){
    const text = await res.text().catch(()=>res.statusText);
    throw new Error(`${res.status} ${text}`);
  }
  return res.json();
}

function setLoading(select, msg='Carregando...'){
  select.innerHTML = `<option>${msg}</option>`;
}

// Carrega todos boards ao iniciar
async function loadBoards(){
  try{
    setLoading(boardSelect,'Carregando quadros...');
    const boards = await apiGet('/members/me/boards?fields=name');
    if(!boards || !boards.length){
      boardSelect.innerHTML = `<option value="">Nenhum quadro</option>`;
      return;
    }
    boardSelect.innerHTML = boards.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
    boardSelect.selectedIndex = 0;
    await loadBoardData();
  }catch(e){
    console.error('loadBoards', e);
    boardSelect.innerHTML = `<option value="">Erro: ${escapeHtml(e.message)}</option>`;
  }
}

// Carrega listas, cards, membros e labels do board selecionado
async function loadBoardData(){
  const boardId = boardSelect.value;
  if(!boardId) return;
  try{
    // listas + cards (lista com cards embutidos)
    listSelect.innerHTML = '';
    setLoading(listSelect, 'Carregando listas...');
    const lists = await apiGet(`/boards/${boardId}/lists?fields=name&cards=all&card_fields=name,idMembers,idLabels`);
    // popula listSelect
    listSelect.innerHTML = lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');
    if(lists.length) listSelect.selectedIndex = 0;

    // popula cardSelect com todos os cards das listas
    cardSelect.innerHTML = `<option value="">Criar novo card</option>`;
    for(const l of lists){
      const cards = l.cards || [];
      for(const c of cards){
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.text = `[${l.name}] ${c.name}`;
        cardSelect.appendChild(opt);
      }
    }

    // carregar membros e labels do board
    await loadBoardMembers(boardId);
    await loadBoardLabels(boardId);

    // limpa campos para criar novo by default
    resetCardFields();

  }catch(e){
    console.error('loadBoardData', e);
  }
}

async function loadBoardMembers(boardId){
  try{
    membersAvailable.innerHTML = '';
    membersSelected.innerHTML = '';
    const members = await apiGet(`/boards/${boardId}/members?fields=fullName,username`);
    for(const m of members){
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.text = `${m.fullName} (${m.username})`;
      membersAvailable.appendChild(opt);
    }
    // se um card está selecionado, mover os membros deste card para selecionados
    const cardId = cardSelect.value;
    if(cardId){
      try{
        const card = await apiGet(`/cards/${cardId}?fields=idMembers`);
        const cardMembers = card.idMembers || [];
        Array.from(membersAvailable.options).forEach(o => {
          if(cardMembers.includes(o.value)){
            membersSelected.appendChild(o);
          }
        });
      }catch(e){ console.warn('erro ao obter membros do card', e); }
    }
  }catch(e){
    console.error('loadBoardMembers', e);
  }
}

async function loadBoardLabels(boardId){
  try{
    labelsAvailable.innerHTML = '';
    labelsSelected.innerHTML = '';
    const labels = await apiGet(`/boards/${boardId}/labels?fields=name,color`);
    for(const lb of labels){
      const opt = document.createElement('option');
      opt.value = lb.id;
      const name = lb.name ? lb.name : (lb.color ? capitalize(lb.color) : '(label)');
      opt.text = `${name}${lb.color ? ' • ' + lb.color : ''}`;
      labelsAvailable.appendChild(opt);
    }
    // se um card está selecionado, mover as labels atribuídas
    const cardId = cardSelect.value;
    if(cardId){
      try{
        const card = await apiGet(`/cards/${cardId}?fields=idLabels`);
        const cardLabels = card.idLabels || [];
        Array.from(labelsAvailable.options).forEach(o=>{
          if(cardLabels.includes(o.value)){
            labelsSelected.appendChild(o);
          }
        });
      }catch(e){ console.warn('erro ao obter labels do card', e); }
    }
  }catch(e){
    console.error('loadBoardLabels', e);
  }
}

// ao selecionar um card, preencher campos e ajustar selected members/labels
cardSelect.addEventListener('change', async ()=>{
  const cardId = cardSelect.value;
  if(!cardId){
    resetCardFields();
    // recarrega members/labels para o board
    const b = boardSelect.value; if(b){ await loadBoardMembers(b); await loadBoardLabels(b);}
    return;
  }
  try{
    const card = await apiGet(`/cards/${cardId}?fields=name,desc,due,idList,idMembers,idLabels,shortUrl`);
    cardNameInput.value = card.name || '';
    cardDescInput.value = card.desc || '';
    dueInput.value = card.due || '';
    // seleciona a lista do card
    if(card.idList){
      const opt = Array.from(listSelect.options).find(o=>o.value===card.idList);
      if(opt) opt.selected = true;
    }
    // recarrega members/labels and move the selected ones
    const boardId = boardSelect.value;
    if(boardId){
      await loadBoardMembers(boardId);
      await loadBoardLabels(boardId);
      // members and labels were moved by the loaders above using card fields
    }
  }catch(e){ console.error('cardSelect change', e); }
});

// Dual list control
function moveSelected(from, to){
  Array.from(from.selectedOptions).forEach(opt=> to.appendChild(opt));
}
addMemberBtn.addEventListener('click', ()=> moveSelected(membersAvailable, membersSelected));
removeMemberBtn.addEventListener('click', ()=> moveSelected(membersSelected, membersAvailable));
fetchMembersBtn.addEventListener('click', ()=> { const b=boardSelect.value; if(b) loadBoardMembers(b); });

addLabelBtn.addEventListener('click', ()=> moveSelected(labelsAvailable, labelsSelected));
removeLabelBtn.addEventListener('click', ()=> moveSelected(labelsSelected, labelsAvailable));
fetchLabelsBtn.addEventListener('click', ()=> { const b=boardSelect.value; if(b) loadBoardLabels(b); });

function getSelectedMembers(){ return Array.from(membersSelected.options).map(o=>o.value).join(','); }
function getSelectedLabels(){ return Array.from(labelsSelected.options).map(o=>o.value).join(','); }

function resetCardFields(){
  cardNameInput.value = '';
  cardDescInput.value = '';
  dueInput.value = '';
}

// submit: criar ou atualizar card
form.addEventListener('submit', async (ev)=>{
  ev.preventDefault();
  responseBox.hidden = true;
  responseBox.textContent = '';

  const selectedCardId = cardSelect.value;
  const idList = listSelect.value;
  const pos = posSelect.value || 'top';
  const idMembers = getSelectedMembers(); // comma separated or '' 
  const idLabels = getSelectedLabels();

  try{
    let cardResp = null;

    if(selectedCardId){
      // update existing card (move + update members/labels/name/desc)
      const params = new URLSearchParams();
      params.append('idList', idList);
      params.append('pos', pos);
      if(idMembers) params.append('idMembers', idMembers);
      else params.append('idMembers', ''); // clear if empty
      if(idLabels) params.append('idLabels', idLabels);
      else params.append('idLabels','');
      const name = cardNameInput.value.trim();
      const desc = cardDescInput.value.trim();
      if(name) params.append('name', name);
      if(desc) params.append('desc', desc);

      const url = getUrl(`/cards/${selectedCardId}`); // includes key/token
      const res = await fetch(url, { method: 'PUT', body: params });
      if(!res.ok) throw new Error(`Erro ao atualizar card: ${res.status}`);
      cardResp = await res.json();
      notify(`Card atualizado: ${cardResp.shortUrl || cardResp.url || cardResp.id}`);
    } else {
      // create new card
      const name = cardNameInput.value.trim();
      if(!name){ alert('Informe o nome do card'); return; }
      const desc = cardDescInput.value.trim();
      const params = new URLSearchParams();
      params.append('name', name);
      params.append('idList', idList);
      params.append('pos', pos);
      if(desc) params.append('desc', desc);
      if(idMembers) params.append('idMembers', idMembers);
      if(idLabels) params.append('idLabels', idLabels);

      const url = getUrl('/cards'); // includes key/token
      const res = await fetch(url + '&' + params.toString(), { method: 'POST' });
      if(!res.ok){
        const t = await res.text().catch(()=>res.statusText);
        throw new Error(`Erro criar card: ${res.status} ${t}`);
      }
      cardResp = await res.json();
      notify(`Card criado: ${cardResp.shortUrl || cardResp.url || cardResp.id}`);
    }

    // show response and shortUrl
    responseBox.textContent = JSON.stringify(cardResp, null, 2);
    responseBox.hidden = false;

    // attachments (after create/update)
    const files = attachmentsInput.files;
    if(files && files.length){
      for(const f of files){
        if(f.size > 10*1024*1024){
          alert(`Arquivo ${f.name} excede 10MB e será ignorado.`);
          continue;
        }
        alert(`Enviando anexo ${f.name}...`);
        const fd = new FormData();
        fd.append('file', f, f.name);
        try{
          const attachRes = await fetch(getUrl(`/cards/${cardResp.id}/attachments`), { method: 'POST', body: fd });
          if(!attachRes.ok){
            const t = await attachRes.text().catch(()=>attachRes.statusText);
            console.error('attach error', t);
            alert(`Erro ao enviar ${f.name}: ${attachRes.status}`);
          } else {
            const attachJson = await attachRes.json();
            alert(`Anexo ${f.name} enviado!`);
            responseBox.textContent += '\n\nAttachment: ' + JSON.stringify(attachJson, null, 2);
          }
        }catch(e){
          console.error('upload error', e);
          alert(`Erro no upload ${f.name}: ${e.message}`);
        }
      }
    }

    // reload to reflect changes
    await loadBoardData();

    // select the card that was created/updated
    if(cardResp && cardResp.id){
      // try to select the card in the dropdown
      const opt = Array.from(cardSelect.options).find(o => o.value === cardResp.id);
      if(opt) opt.selected = true;
    }

  }catch(e){
    console.error('submit error', e);
    alert('Erro: ' + (e.message || e));
    responseBox.textContent = 'Erro: ' + (e.message || e);
    responseBox.hidden = false;
  }
});

resetBtn.addEventListener('click', ()=>{
  form.reset();
  membersAvailable.innerHTML = '';
  membersSelected.innerHTML = '';
  labelsAvailable.innerHTML = '';
  labelsSelected.innerHTML = '';
  listSelect.innerHTML = '';
  cardSelect.innerHTML = '<option value="">Criar novo card</option>';
  responseBox.textContent = '';
  responseBox.hidden = true;
});

toggleResponse.addEventListener('click', ()=> {
  responseBox.hidden = !responseBox.hidden;
});

boardSelect.addEventListener('change', loadBoardData);
listSelect.addEventListener('change', ()=>{/* nothing for now */});

function notify(msg){
  console.log(msg);
  responseBox.textContent = (responseBox.textContent ? responseBox.textContent + '\n\n' : '') + msg;
  responseBox.hidden = false;
}

function escapeHtml(s){
  if(!s) return '';
  return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function capitalize(s){ return s && s.length ? s[0].toUpperCase()+s.slice(1):s; }

// inicializa
window.addEventListener('DOMContentLoaded', loadBoards);
