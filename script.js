const apiKey = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken = "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";

const boardSelect = document.getElementById('boardSelect');
const listSelect = document.getElementById('listSelect');
const refreshBtn = document.getElementById('refreshCards');
const openCreateModalBtn = document.getElementById('openCreateModal');
const cardsList = document.getElementById('cardsList');
const cardDetails = document.getElementById('cardDetails');
const searchInput = document.getElementById('searchInput');
const searchSection = document.getElementById('searchSection');

const createModal = document.getElementById('createModal');
const closeCreateModal = document.getElementById('closeCreateModal');
const cancelCreate = document.getElementById('cancelCreate');
const createCardBtn = document.getElementById('createCardBtn');
const newCardName = document.getElementById('newCardName');
const newCardDesc = document.getElementById('newCardDesc');
const newCardMembers = document.getElementById('newCardMembers');
const newCardLabels = document.getElementById('newCardLabels');
const createFeedback = document.getElementById('createFeedback');

let boards = [], lists = [], currentBoard = null, currentList = null, allCards = [];

const TRELLO = (endpoint, params = {}) => {
  const url = new URL(`https://api.trello.com/1/${endpoint}`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', apiToken);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
};

async function loadBoards() {
  const res = await fetch(TRELLO('members/me/boards', { fields: 'name' }));
  boards = await res.json();
  boardSelect.innerHTML = '<option value="">Selecione um quadro...</option>';
  boards.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.name;
    boardSelect.appendChild(o);
  });
}

async function loadLists(boardId) {
  const res = await fetch(TRELLO(`boards/${boardId}/lists`, { fields: 'name' }));
  lists = await res.json();
  listSelect.innerHTML = '<option value="">Selecione uma lista...</option>';
  lists.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    listSelect.appendChild(o);
  });
  listSelect.disabled = false;
  openCreateModalBtn.disabled = false;
}

async function loadCards(listId) {
  const res = await fetch(TRELLO(`lists/${listId}/cards`, { fields: 'name,desc,labels,dateLastActivity' }));
  allCards = await res.json();
  renderCards(allCards);
  searchSection.style.display = 'block';
}

function renderCards(cards) {
  cardsList.innerHTML = '';
  if (!cards.length) {
    cardsList.innerHTML = '<p>Nenhum card encontrado.</p>';
    return;
  }
  cards.forEach(c => {
    const div = document.createElement('div');
    div.className = 'card-item';
    div.innerHTML = `
      <div class="card-title-row">
        <h4 class="card-title">${c.name}</h4>
        <button class="view-details btn">Detalhes</button>
      </div>
      <div class="label-list">
        ${c.labels.map(l => `<span class="label-pill">${l.name || l.color}</span>`).join('')}
      </div>`;
    div.querySelector('.view-details').onclick = () => showCardDetails(c.id);
    cardsList.appendChild(div);
  });
}

async function showCardDetails(cardId) {
  const res = await fetch(TRELLO(`cards/${cardId}`, { fields: 'name,desc,labels,shortUrl,dateLastActivity' }));
  const c = await res.json();
  cardDetails.classList.remove('hidden');
  cardDetails.innerHTML = `
    <h3>${c.name}</h3>
    <p><b>Última atividade:</b> ${new Date(c.dateLastActivity).toLocaleString()}</p>
    <p>${c.desc || 'Sem descrição'}</p>
    <h4>Etiquetas:</h4>
    ${c.labels.map(l => `<span class="label-pill">${l.name || l.color}</span>`).join('') || '—'}
    <p><a href="${c.shortUrl}" target="_blank">Abrir no Trello</a></p>
  `;
}

/* Busca */
searchInput.addEventListener('input', () => {
  const q = searchInput.value.toLowerCase();
  if (!q) return renderCards(allCards);
  const filtered = allCards.filter(c =>
    c.name.toLowerCase().includes(q) ||
    c.desc.toLowerCase().includes(q)
  );
  renderCards(filtered);
});

/* Modal */
function openCreateModal() {
  createModal.classList.remove('hidden');
  createFeedback.textContent = '';
  newCardName.value = '';
  newCardDesc.value = '';
}

function closeCreate() {
  createModal.classList.add('hidden');
}

openCreateModalBtn.onclick = openCreateModal;
closeCreateModal.onclick = closeCreate;
cancelCreate.onclick = closeCreate;

createCardBtn.onclick = async () => {
  const name = newCardName.value.trim();
  if (!name) {
    createFeedback.textContent = '⚠️ Digite um nome para o card.';
    createFeedback.classList.add('error');
    return;
  }
  const desc = newCardDesc.value.trim();
  const res = await fetch(TRELLO('cards', { idList: currentList.id, name, desc }), { method: 'POST' });
  if (!res.ok) {
    createFeedback.textContent = '❌ Erro ao criar card.';
    return;
  }
  createFeedback.textContent = '✅ Card criado!';
  setTimeout(() => {
    closeCreate();
    loadCards(currentList.id);
  }, 1000);
};

/* Eventos */
boardSelect.onchange = async () => {
  const id = boardSelect.value;
  if (!id) return;
  currentBoard = boards.find(b => b.id === id);
  await loadLists(id);
};

listSelect.onchange = async () => {
  const id = listSelect.value;
  if (!id) return;
  currentList = lists.find(l => l.id === id);
  await loadCards(id);
};

refreshBtn.onclick = () => {
  if (currentList) loadCards(currentList.id);
};

/* Inicialização */
loadBoards();
