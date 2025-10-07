// ====== CONFIG ======
const apiKey = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken = "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

// ====== ELEMENTOS ======
const boardSelect = document.getElementById('boardSelect');
const listSelect = document.getElementById('listSelect');
const cardSelect = document.getElementById('cardSelect');
const posSelect = document.getElementById('posSelect');
const cardNameInput = document.getElementById('cardName');
const cardDescInput = document.getElementById('cardDesc');

const membersAvailable = document.getElementById('membersAvailable');
const membersSelected = document.getElementById('membersSelected');
const addMemberBtn = document.getElementById('addMember');
const removeMemberBtn = document.getElementById('removeMember');

const labelsAvailable = document.getElementById('labelsAvailable');
const labelsSelected = document.getElementById('labelsSelected');
const addLabelBtn = document.getElementById('addLabel');
const removeLabelBtn = document.getElementById('removeLabel');

const attachmentsInput = document.getElementById('attachments');
const dropArea = document.getElementById('dropArea');
const pendingList = document.getElementById('pendingList');
const clearPendingBtn = document.getElementById('clearPending');

const form = document.getElementById('trelloForm');
const responseBox = document.getElementById('response');
const resetBtn = document.getElementById('resetBtn');
const toggleResponse = document.getElementById('toggleResponse');
const attachmentsList = document.getElementById('attachmentsList');

// fila de anexos pendentes (antes de enviar)
let pendingFiles = [];

// ====== HELPERS API ======
function getUrl(path) {
  return `https://api.trello.com/1${path}${path.includes('?') ? '&' : '?'}key=${apiKey}&token=${apiToken}`;
}
async function apiGet(path) {
  const res = await fetch(getUrl(path));
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPostForm(path, formData) {
  const res = await fetch(getUrl(path), { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPutForm(path, formData) {
  const res = await fetch(getUrl(path), { method: 'PUT', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
function setLoading(select, msg = 'Carregando...') {
  select.innerHTML = `<option>${msg}</option>`;
}

// ====== LOAD BOARDS/LISTS/CARDS ======
async function loadBoards() {
  setLoading(boardSelect, 'Carregando quadros...');
  try {
    const boards = await apiGet('/members/me/boards?fields=name');
    boardSelect.innerHTML = boards.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    if (boards.length > 0) await loadBoardData();
  } catch (e) {
    boardSelect.innerHTML = `<option>Erro: ${e.message}</option>`;
  }
}

async function loadBoardData() {
  const boardId = boardSelect.value;
  if (!boardId) return;

  setLoading(listSelect, 'Carregando listas...');
  setLoading(cardSelect, 'Carregando cards...');

  try {
    const lists = await apiGet(`/boards/${boardId}/lists?fields=name&cards=all&card_fields=name`);
    listSelect.innerHTML = lists.map(l => `<option value="${l.id}">${l.name}</option>`).join('');

    cardSelect.innerHTML = `<option value="">Criar novo card</option>`;
    lists.forEach(l => (l.cards || []).forEach(c => {
      const o = document.createElement('option');
      o.value = c.id;
      o.text = `[${l.name}] ${c.name}`;
      cardSelect.appendChild(o);
    }));

    await loadBoardMembers(boardId);
    await loadBoardLabels(boardId);
    resetCardFields();
    clearPending(); // evita anexar no card errado ao trocar de board
  } catch (e) {
    console.error('Erro ao carregar board:', e);
  }
}

async function loadBoardMembers(boardId) {
  membersAvailable.innerHTML = '';
  membersSelected.innerHTML = '';
  const members = await apiGet(`/boards/${boardId}/members?fields=fullName,username`);
  members.forEach(m => {
    const o = document.createElement('option');
    o.value = m.id;
    o.text = `${m.fullName} (${m.username})`;
    membersAvailable.appendChild(o);
  });
  await loadCardMembers();
}

async function loadBoardLabels(boardId) {
  labelsAvailable.innerHTML = '';
  labelsSelected.innerHTML = '';
  const labels = await apiGet(`/boards/${boardId}/labels?fields=name,color`);
  labels.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    o.text = l.name || l.color;
    labelsAvailable.appendChild(o);
  });
  await loadCardLabels();
}

// ====== CARD MEMBERS/LABELS & FIELDS ======
async function loadCardMembers() {
  membersSelected.innerHTML = '';
  const cardId = cardSelect.value;
  if (!cardId) return;
  const card = await apiGet(`/cards/${cardId}?fields=idMembers`);
  Array.from(membersAvailable.options).forEach(o => {
    if (card.idMembers.includes(o.value)) membersSelected.appendChild(o);
  });
}

async function loadCardLabels() {
  labelsSelected.innerHTML = '';
  const cardId = cardSelect.value;
  if (!cardId) return;
  const card = await apiGet(`/cards/${cardId}?fields=idLabels`);
  Array.from(labelsAvailable.options).forEach(o => {
    if (card.idLabels.includes(o.value)) labelsSelected.appendChild(o);
  });
}

async function fillCardFields() {
  const cardId = cardSelect.value;
  if (!cardId) {
    cardNameInput.value = '';
    cardDescInput.value = '';
    attachmentsList.innerHTML = '';
    return;
  }
  try {
    const card = await apiGet(`/cards/${cardId}?fields=name,desc`);
    cardNameInput.value = card.name || '';
    cardDescInput.value = card.desc || '';
    const attachments = await apiGet(`/cards/${cardId}/attachments`);
    renderExistingAttachments(attachments);
  } catch {
    cardNameInput.value = '';
    cardDescInput.value = '';
    attachmentsList.innerHTML = '';
  }
}

// ====== EXISTING ATTACHMENTS (server) ======
function renderExistingAttachments(attachments) {
  if (!attachments || attachments.length === 0) {
    attachmentsList.innerHTML = '<p style="color:#555;font-size:13px;">Nenhum anexo neste card.</p>';
    return;
  }
  attachmentsList.innerHTML = `
    <p style="font-weight:600;">Anexos existentes:</p>
    <ul style="padding-left:15px;font-size:13px;">
      ${attachments.map(a => `<li><a href="${a.url}" target="_blank">${a.name}</a></li>`).join('')}
    </ul>
  `;
}

// ====== PENDING ATTACHMENTS (client queue) ======
function bytesToSize(b) {
  if (!b && b !== 0) return '';
  const u = ['B','KB','MB','GB']; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${u[i]}`;
}

function addPendingFiles(files) {
  const accepted = [];
  for (const file of files) {
    if (!file) continue;
    if (file.size > 10 * 1024 * 1024) {
      alert(`"${file.name}" tem ${bytesToSize(file.size)} — limite é 10MB. Ignorado.`);
      continue;
    }
    accepted.push(file);
  }
  if (!accepted.length) return;
  pendingFiles.push(...accepted);
  renderPending();
}

function removePendingAt(index) {
  pendingFiles.splice(index, 1);
  renderPending();
}

function clearPending() {
  pendingFiles = [];
  renderPending();
}

function renderPending() {
  pendingList.innerHTML = '';
  if (pendingFiles.length === 0) {
    pendingList.innerHTML = `<li style="color:#777;font-size:13px;">Nenhum anexo pendente.</li>`;
    return;
  }
  pendingFiles.forEach((file, idx) => {
    const li = document.createElement('li');
    li.className = 'pending-item';
    li.innerHTML = `
      <div class="pending-name">${file.name}</div>
      <div class="pending-size">${bytesToSize(file.size)}</div>
      <button type="button" class="pending-remove small">Remover</button>
    `;
    li.querySelector('.pending-remove').onclick = () => removePendingAt(idx);
    pendingList.appendChild(li);
  });
}

// ====== DROP / PASTE / INPUT ======
attachmentsInput.addEventListener('change', (e) => {
  addPendingFiles(e.target.files);
  attachmentsInput.value = ''; // limpa seleção para permitir escolher novamente
});

dropArea.addEventListener('click', () => attachmentsInput.click());

dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('dragover');
});
dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('dragover');
  if (e.dataTransfer && e.dataTransfer.files) {
    addPendingFiles(e.dataTransfer.files);
  }
});

window.addEventListener('paste', (e) => {
  if (!e.clipboardData || !e.clipboardData.items) return;
  const items = e.clipboardData.items;
  const files = [];
  for (const it of items) {
    if (it.kind === 'file') {
      const f = it.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) {
    addPendingFiles(files);
  }
});

clearPendingBtn.addEventListener('click', clearPending);

// ====== PROGRESS BAR ======
function createProgressBar(fileName) {
  const container = document.createElement('div');
  container.className = 'progress-container';
  container.innerHTML = `
    <span>${fileName}</span>
    <div class="progress-bar"><div class="progress"></div></div>
  `;
  pendingList.insertAdjacentElement('afterend', container);
  return container.querySelector('.progress');
}

async function uploadWithProgress(path, formData, progressElement) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', getUrl(path));

    xhr.upload.onprogress = e => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total) * 100;
        progressElement.style.width = `${percent}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
      else reject(xhr.statusText);
    };
    xhr.onerror = () => reject('Erro de rede');
    xhr.send(formData);
  });
}

// ====== INTERAÇÕES ======
addMemberBtn.onclick = () => Array.from(membersAvailable.selectedOptions).forEach(o => membersSelected.appendChild(o));
removeMemberBtn.onclick = () => Array.from(membersSelected.selectedOptions).forEach(o => membersAvailable.appendChild(o));
addLabelBtn.onclick = () => Array.from(labelsAvailable.selectedOptions).forEach(o => labelsSelected.appendChild(o));
removeLabelBtn.onclick = () => Array.from(labelsSelected.selectedOptions).forEach(o => labelsAvailable.appendChild(o));

boardSelect.onchange = async () => await loadBoardData();
cardSelect.onchange = async () => { await loadCardMembers(); await loadCardLabels(); await fillCardFields(); clearPending(); };
resetBtn.onclick = resetCardFields;
toggleResponse.onclick = () => (responseBox.hidden = !responseBox.hidden);

function resetCardFields() {
  cardNameInput.value = '';
  cardDescInput.value = '';
  Array.from(membersSelected.options).forEach(o => membersAvailable.appendChild(o));
  Array.from(labelsSelected.options).forEach(o => labelsAvailable.appendChild(o));
  attachmentsList.innerHTML = '';
  clearPending();
}

// ====== SUBMIT (criar/atualizar + upload pendentes) ======
form.addEventListener('submit', async ev => {
  ev.preventDefault();
  const listId = listSelect.value;
  const cardId = cardSelect.value;
  const name = cardNameInput.value;
  const desc = cardDescInput.value;
  const pos = posSelect.value;
  const idMembers = Array.from(membersSelected.options).map(o => o.value);
  const idLabels = Array.from(labelsSelected.options).map(o => o.value);

  try {
    let card;
    if (cardId) {
      // Atualizar
      card = await apiPutForm(`/cards/${cardId}`, new URLSearchParams({
        idList: listId, name, desc,
        idMembers: idMembers.join(','), idLabels: idLabels.join(','), pos
      }));
    } else {
      // Criar
      if (!name || !listId) { alert('Informe nome do card e lista.'); return; }
      card = await apiPostForm(`/cards`, new URLSearchParams({
        idList: listId, name, desc,
        idMembers: idMembers.join(','), idLabels: idLabels.join(','), pos
      }));
    }

    responseBox.textContent = JSON.stringify(card, null, 2);

    // Envio dos anexos pendentes
    if (pendingFiles.length) {
      for (const file of pendingFiles) {
        const fd = new FormData();
        fd.append('file', file);
        const progressEl = createProgressBar(file.name);
        await uploadWithProgress(`/cards/${card.id}/attachments`, fd, progressEl);
      }
      clearPending();
      // atualizar lista de anexos existentes
      const attachments = await apiGet(`/cards/${card.id}/attachments`);
      renderExistingAttachments(attachments);
    }

    alert(`✅ Card salvo!\n🔗 ${card.shortUrl}`);
    await loadBoardData();
    cardSelect.value = card.id;
    await fillCardFields();
    await loadCardMembers();
    await loadCardLabels();

  } catch (e) {
    responseBox.textContent = e.message;
  }
});

// ====== START ======
window.onload = loadBoards;
