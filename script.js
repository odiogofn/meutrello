/* ========================================
   script.js — Gestão Trello (versão completa e moderna)
   ======================================== */

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

// ========================= UTILITÁRIOS =========================

function getUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `https://api.trello.com/1${path}${sep}key=${encodeURIComponent(apiKey)}&token=${encodeURIComponent(apiToken)}`;
}

async function apiGet(path) {
  const res = await fetch(getUrl(path));
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

function escapeHtml(s) {
  return s ? s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) : '';
}
function capitalize(s) { return s && s.length ? s[0].toUpperCase() + s.slice(1) : s; }

function setLoading(select, msg = 'Carregando...') {
  select.innerHTML = `<option>${msg}</option>`;
}

function notify(msg) {
  responseBox.textContent += '\n' + msg;
  responseBox.hidden = false;
}

// ========================= LOADERS =========================

async function loadBoards() {
  setLoading(boardSelect);
  const boards = await apiGet('/members/me/boards?fields=name');
  boardSelect.innerHTML = boards.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');
  if (boards.length) {
    boardSelect.selectedIndex = 0;
    await loadBoardData();
  }
}

async function loadBoardData() {
  const boardId = boardSelect.value;
  if (!boardId) return;

  setLoading(listSelect);
  const lists = await apiGet(`/boards/${boardId}/lists?fields=name`);
  listSelect.innerHTML = lists.map(l => `<option value="${l.id}">${escapeHtml(l.name)}</option>`).join('');

  if (lists.length) await loadCardsForList(lists[0].id);
  await loadBoardMembers(boardId);
  await loadBoardLabels(boardId);
  resetCardFields();
}

async function loadCardsForList(listId) {
  if (!listId) return;
  setLoading(cardSelect);
  const cards = await apiGet(`/lists/${listId}/cards?fields=name,shortUrl,url`);
  cardSelect.innerHTML = `<option value="">Criar novo card</option>`;
  for (const c of cards) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.text = c.name;
    opt.dataset.shortUrl = c.shortUrl;
    opt.dataset.url = c.url;
    cardSelect.appendChild(opt);
  }
}

async function loadBoardMembers(boardId) {
  membersAvailable.innerHTML = '';
  membersSelected.innerHTML = '';
  const members = await apiGet(`/boards/${boardId}/members?fields=fullName,username`);
  for (const m of members) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.text = `${m.fullName} (${m.username})`;
    membersAvailable.appendChild(opt);
  }
}

async function loadBoardLabels(boardId) {
  labelsAvailable.innerHTML = '';
  labelsSelected.innerHTML = '';
  const labels = await apiGet(`/boards/${boardId}/labels?fields=name,color`);
  for (const lb of labels) {
    const opt = document.createElement('option');
    opt.value = lb.id;
    const name = lb.name || (lb.color ? capitalize(lb.color) : '(sem nome)');
    opt.text = `${name}${lb.color ? ' • ' + lb.color : ''}`;
    labelsAvailable.appendChild(opt);
  }
}

// ========================= CARD SELECIONADO =========================

cardSelect.addEventListener('change', async () => {
  const cardId = cardSelect.value;
  if (!cardId) {
    resetCardFields();
    const b = boardSelect.value;
    if (b) { await loadBoardMembers(b); await loadBoardLabels(b); }
    return;
  }

  const card = await apiGet(`/cards/${cardId}?fields=name,desc,due,idList,idMembers,idLabels,shortUrl,url`);
  cardNameInput.value = card.name || '';
  cardDescInput.value = card.desc || '';
  dueInput.value = card.due || '';
  const opt = Array.from(listSelect.options).find(o => o.value === card.idList);
  if (opt) opt.selected = true;

  await populateCardMembers(card.idMembers);
  await populateCardLabels(card.idLabels);

  responseBox.textContent = `Short URL: ${card.shortUrl}\nFull URL: ${card.url}`;
  responseBox.hidden = false;
});

async function populateCardMembers(idMembers) {
  membersSelected.innerHTML = '';
  Array.from(membersAvailable.options).forEach(o => {
    if (idMembers.includes(o.value)) membersSelected.appendChild(o);
  });
}

async function populateCardLabels(idLabels) {
  labelsSelected.innerHTML = '';
  Array.from(labelsAvailable.options).forEach(o => {
    if (idLabels.includes(o.value)) labelsSelected.appendChild(o);
  });
}

// ========================= FUNÇÕES AUXILIARES =========================

function moveSelected(from, to) {
  Array.from(from.selectedOptions).forEach(opt => to.appendChild(opt));
}
addMemberBtn.onclick = () => moveSelected(membersAvailable, membersSelected);
removeMemberBtn.onclick = () => moveSelected(membersSelected, membersAvailable);
addLabelBtn.onclick = () => moveSelected(labelsAvailable, labelsSelected);
removeLabelBtn.onclick = () => moveSelected(labelsSelected, labelsAvailable);

function getSelectedMembers() { return Array.from(membersSelected.options).map(o => o.value).join(','); }
function getSelectedLabels() { return Array.from(labelsSelected.options).map(o => o.value).join(','); }

function resetCardFields() {
  cardNameInput.value = '';
  cardDescInput.value = '';
  dueInput.value = '';
}

// ========================= SUBMISSÃO DE CARD =========================

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  responseBox.hidden = true;
  responseBox.textContent = '';

  const cardId = cardSelect.value;
  const idList = listSelect.value;
  const pos = posSelect.value || 'top';
  const idMembers = getSelectedMembers();
  const idLabels = getSelectedLabels();
  const name = cardNameInput.value.trim();
  const desc = cardDescInput.value.trim();

  let cardResp;

  if (cardId) {
    const params = new URLSearchParams({ idList, pos, idMembers, idLabels, name, desc });
    const res = await fetch(getUrl(`/cards/${cardId}`), { method: 'PUT', body: params });
    if (!res.ok) throw new Error('Erro ao atualizar card');
    cardResp = await res.json();
    notify(`Card atualizado: ${cardResp.shortUrl}`);
  } else {
    if (!name) return alert('Informe o nome do card');
    const params = new URLSearchParams({ name, idList, pos, desc, idMembers, idLabels });
    const res = await fetch(getUrl('/cards') + '&' + params.toString(), { method: 'POST' });
    if (!res.ok) throw new Error('Erro ao criar card');
    cardResp = await res.json();
    notify(`Card criado: ${cardResp.shortUrl}`);
  }

  responseBox.textContent = JSON.stringify(cardResp, null, 2);
  responseBox.hidden = false;
  await uploadAttachments(cardResp.id);
  await loadCardsForList(idList);
});

async function uploadAttachments(cardId) {
  const files = attachmentsInput.files;
  if (!files.length) return;
  for (const f of files) {
    if (f.size > 10 * 1024 * 1024) {
      alert(`Arquivo ${f.name} excede 10MB.`);
      continue;
    }
    const fd = new FormData();
    fd.append('file', f, f.name);
    const res = await fetch(getUrl(`/cards/${cardId}/attachments`), { method: 'POST', body: fd });
    if (!res.ok) alert(`Erro ao enviar ${f.name}`);
  }
}

// ========================= UPLOAD VISUAL =========================

// Cria a área de upload visual
const dropZone = document.createElement('div');
dropZone.id = 'dropZone';
dropZone.textContent = 'Arraste arquivos aqui ou cole (Ctrl+V)';
attachmentsInput.parentNode.insertBefore(dropZone, attachmentsInput);
attachmentsInput.style.display = 'none';

// Eventos drag & drop
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  attachmentsInput.files = e.dataTransfer.files;
  previewFiles(attachmentsInput.files);
});

// Evento Ctrl+V
document.addEventListener('paste', e => {
  const items = e.clipboardData.items;
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      const dt = new DataTransfer();
      dt.items.add(file);
      attachmentsInput.files = dt.files;
      previewFiles([file]);
    }
  }
});

// ========================= PREVIEW AVANÇADO DE ARQUIVOS =========================

function previewFiles(files) {
  let preview = document.getElementById('previewArea');
  if (!preview) {
    preview = document.createElement('div');
    preview.id = 'previewArea';
    dropZone.insertAdjacentElement('afterend', preview);
  }
  preview.innerHTML = '';

  for (const f of files) {
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-preview';

    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = e => {
        const img = document.createElement('img');
        img.src = e.target.result;
        fileDiv.appendChild(img);
      };
      reader.readAsDataURL(f);
    } else {
      const icon = document.createElement('div');
      icon.className = 'file-icon';
      icon.innerHTML = getFileIcon(f.name);
      const name = document.createElement('div');
      name.className = 'file-name';
      name.textContent = f.name;
      fileDiv.append(icon, name);
    }
    preview.appendChild(fileDiv);
  }
}

// Mapeamento de ícones e cores por tipo de arquivo
function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: '📕',
    doc: '📘',
    docx: '📘',
    xls: '📊',
    xlsx: '📊',
    csv: '🧾',
    txt: '📄',
    zip: '🗜️',
    rar: '🗜️',
    mp4: '🎥',
    avi: '🎞️',
    mp3: '🎵',
    wav: '🎧',
    ppt: '📙',
    pptx: '📙'
  };
  return icons[ext] || '📁';
}

// ========================= EVENTOS GERAIS =========================

boardSelect.addEventListener('change', loadBoardData);
listSelect.addEventListener('change', () => loadCardsForList(listSelect.value));
resetBtn.addEventListener('click', () => location.reload());
toggleResponse.addEventListener('click', () => responseBox.hidden = !responseBox.hidden);
window.addEventListener('DOMContentLoaded', loadBoards);
