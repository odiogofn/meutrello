// ===== CONFIG =====
const apiKey   = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken = "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";
const apiBase  = "https://api.trello.com/1";

// ===== DOM =====
const boardSelect  = document.getElementById("boardSelect");
const treeBtn      = document.getElementById("loadTreeView");
const treeContainer= document.getElementById("treeContainer");
const filterArea   = document.getElementById("filterArea");
const labelFilter  = document.getElementById("labelFilter");
const searchInput  = document.getElementById("searchInput");
const dateModeSel  = document.getElementById("dateMode");
const dateStartInp = document.getElementById("dateStart");
const dateEndInp   = document.getElementById("dateEnd");
const clearDatesBtn= document.getElementById("clearDates");

// ===== API helpers =====
async function apiGet(endpoint){
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${apiBase}${endpoint}${sep}key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPut(endpoint, body={}){
  const url = `${apiBase}${endpoint}?key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url, {
    method:"PUT", headers:{ "Content-Type":"application/json" }, body:JSON.stringify(body)
  });
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(endpoint){
  const url = `${apiBase}${endpoint}?key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url, { method:"DELETE" });
  if(!res.ok) throw new Error(await res.text());
  return true;
}
function trelloColor(name){
  const map={
    green:"#61BD4F", yellow:"#F2D600", orange:"#FF9F1A", red:"#EB5A46",
    purple:"#C377E0", blue:"#0079BF", sky:"#00C2E0", lime:"#51E898",
    pink:"#FF78CB", black:"#4D4D4D"
  };
  return map[name] || "#B6BBBF";
}

// ===== util: data de criação a partir do ID do card =====
// id Trello: primeiros 8 hex = segundos desde 1970
function getCreatedDateFromId(id){
  const tsSec = parseInt(id.substring(0,8), 16);
  return new Date(tsSec * 1000);
}

// ===== Boards =====
async function loadBoards(){
  const boards = await apiGet(`/members/me/boards`);
  boardSelect.innerHTML = boards.map(b=>`<option value="${b.id}">${b.name}</option>`).join("");
}
loadBoards();

// ===== Estado global =====
let globalData = { boards:[], lists:[], cards:[], members:[], labels:[] };

// ===== eventos de filtros (tempo real) =====
[labelFilter, searchInput, dateModeSel, dateStartInp, dateEndInp].forEach(el=>{
  el?.addEventListener("input", renderTree);
});
clearDatesBtn.addEventListener("click", ()=>{
  dateStartInp.value=""; dateEndInp.value="";
  renderTree();
});

// ===== Carrega dados do quadro =====
treeBtn.addEventListener("click", async ()=>{
  const boardId = boardSelect.value;
  if(!boardId) return alert("Selecione um quadro primeiro.");

  treeContainer.innerHTML = `<p style="text-align:center;">⏳ Carregando...</p>`;
  const [boards, lists, cards, members, labels] = await Promise.all([
    apiGet(`/members/me/boards`),
    apiGet(`/boards/${boardId}/lists`),
    // incluímos: id, name, desc, idList, idMembers, idLabels, shortUrl, pos, dateLastActivity
    apiGet(`/boards/${boardId}/cards?fields=id,name,desc,idList,idMembers,idLabels,shortUrl,pos,dateLastActivity`),
    apiGet(`/boards/${boardId}/members`),
    apiGet(`/boards/${boardId}/labels`)
  ]);

  // Enriquecer cards com createdAt derivado do id
  cards.forEach(c => c.createdAt = getCreatedDateFromId(c.id));

  globalData = { boards, lists, cards, members, labels };
  // montar filtros
  labelFilter.innerHTML = `<option value="all">Todas</option>` +
    labels.map(l=>`<option value="${l.id}" style="color:${trelloColor(l.color)};">${l.name || l.color}</option>`).join("");
  filterArea.style.display = "block";

  renderTree();
});

// ===== render =====
function renderTree(){
  const { boards, lists, cards, members, labels } = globalData;

  // filtros
  const labelVal = labelFilter.value;
  const q = (searchInput?.value || "").toLowerCase();
  const dateMode = dateModeSel.value; // "created" | "updated"
  const dStart = dateStartInp.value ? new Date(dateStartInp.value + "T00:00:00") : null;
  const dEnd   = dateEndInp.value   ? new Date(dateEndInp.value   + "T23:59:59") : null;

  let filtered = cards.slice();

  if(labelVal !== "all"){
    filtered = filtered.filter(c => c.idLabels.includes(labelVal));
  }
  if(q){
    filtered = filtered.filter(c => c.name.toLowerCase().includes(q));
  }
  if(dStart || dEnd){
    filtered = filtered.filter(c=>{
      const refDate = (dateMode === "created") ? c.createdAt : new Date(c.dateLastActivity);
      if(dStart && refDate < dStart) return false;
      if(dEnd   && refDate > dEnd)   return false;
      return true;
    });
  }

  treeContainer.innerHTML = "";
  const tree = document.createElement("ul");
  tree.className = "tree";

  lists.forEach(list=>{
    const listNode = document.createElement("li");
    listNode.className = "list-node";
    listNode.dataset.listId = list.id;

    const toggleBtn = document.createElement("span");
    toggleBtn.className = "toggle-btn";
    toggleBtn.textContent = "▼";
    toggleBtn.onclick = ()=>{
      const cardsEl = listNode.querySelector("ul");
      if(cardsEl.style.display === "none"){ cardsEl.style.display="block"; toggleBtn.textContent="▼"; }
      else { cardsEl.style.display="none"; toggleBtn.textContent="▶"; }
    };

    const title = document.createElement("span");
    title.className = "list-title";
    title.textContent = list.name;

    listNode.appendChild(toggleBtn);
    listNode.appendChild(title);

    const cardList = document.createElement("ul");
    const listCards = filtered.filter(c=>c.idList===list.id).sort((a,b)=>a.pos - b.pos);

    listCards.forEach(card=>{
      const cardNode = document.createElement("li");
      cardNode.className = "card-node";
      cardNode.dataset.cardId = card.id;
      cardNode.dataset.pos = card.pos;

      // ===== título (com edição por duplo clique ilimitada) =====
      const titleSpan = createEditableTitleSpan(card, cardNode);
      cardNode.appendChild(titleSpan);

      // ===== detalhes =====
      titleSpan.addEventListener("click", ()=>toggleDetails(card, cardNode));

      cardList.appendChild(cardNode);
    });

    // SortableJS para arrastar
    Sortable.create(cardList, {
      group:"shared",
      animation:150,
      ghostClass:"sortable-ghost",
      chosenClass:"sortable-chosen",
      onEnd: async (evt)=>{
        const cardId = evt.item.dataset.cardId;
        const newListId = evt.to.closest(".list-node").dataset.listId;
        const before = evt.item.previousElementSibling;
        const after  = evt.item.nextElementSibling;
        let pos = "bottom";
        if(before && before.dataset.pos && after && after.dataset.pos){
          pos = (parseFloat(before.dataset.pos) + parseFloat(after.dataset.pos)) / 2;
        } else if(before && before.dataset.pos){
          pos = parseFloat(before.dataset.pos) + 1;
        } else if(after && after.dataset.pos){
          pos = parseFloat(after.dataset.pos) - 1;
        } else {
          pos = "top";
        }
        const updated = await apiPut(`/cards/${cardId}`, { idList:newListId, pos });
        // manter dataset.pos em sincronia
        evt.item.dataset.pos = updated.pos ?? pos;
      }
    });

    listNode.appendChild(cardList);
    tree.appendChild(listNode);
  });

  treeContainer.appendChild(tree);
}

// ===== componente: título editável (resolve “só edita 1x”) =====
function createEditableTitleSpan(card, cardNode){
  const span = document.createElement("span");
  span.className = "card-title";
  span.textContent = `📄 ${card.name}`;

  const enableEdit = ()=>{
    const oldName = card.name;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "card-edit";
    input.value = oldName;
    span.replaceWith(input);
    input.focus();

    const save = async ()=>{
      const newName = input.value.trim();
      if(newName && newName !== oldName){
        try{
          await apiPut(`/cards/${card.id}`, { name:newName });
          card.name = newName;
        }catch(err){
          alert("Erro ao renomear: " + err.message);
        }
      }
      const newSpan = createEditableTitleSpan(card, cardNode); // 🔁 recria com eventos
      input.replaceWith(newSpan);
      // reanexa click de detalhes
      newSpan.addEventListener("click", ()=>toggleDetails(card, cardNode));
    };

    input.addEventListener("blur", save);
    input.addEventListener("keydown", e=>{ if(e.key==="Enter") save(); });
  };

  // importante: reatribuir sempre que recriar
  span.addEventListener("dblclick", enableEdit);

  return span;
}

// ===== detalhes =====
function toggleDetails(card, cardNode){
  const existing = cardNode.querySelector(".card-details");
  if(existing){ existing.remove(); return; }

  const { members, labels, boards } = globalData;

  const details = document.createElement("div");
  details.className = "card-details";

  const memberNames = card.idMembers
    .map(id => members.find(m => m.id === id)?.fullName || "")
    .filter(Boolean).join(", ") || "Sem membros";

  const labelHTML = card.idLabels
    .map(id => globalData.labels.find(l => l.id === id))
    .filter(Boolean)
    .map(l => `<span class="label" style="background:${trelloColor(l.color)};">${l.name || " "}</span>`)
    .join(" ") || "(sem etiquetas)";

  const createdStr = card.createdAt ? card.createdAt.toLocaleString() : "-";
  const updatedStr = card.dateLastActivity ? new Date(card.dateLastActivity).toLocaleString() : "-";

  details.innerHTML = `
    <p><strong>Membros:</strong> ${memberNames}</p>
    <p><strong>Etiquetas:</strong> ${labelHTML}</p>
    <p><strong>Criado em:</strong> ${createdStr}</p>
    <p><strong>Última alteração:</strong> ${updatedStr}</p>
    <p><strong>Descrição:</strong><br>${card.desc || "(sem descrição)"}</p>
    <p><a href="${card.shortUrl}" target="_blank">🔗 Abrir no Trello</a></p>
    <div class="actions">
      <button class="btn-move">🔁 Alterar Local</button>
      <button class="btn-archive">📦 Arquivar</button>
      <button class="btn-delete">🗑️ Excluir</button>
    </div>
  `;

  details.querySelector(".btn-archive").addEventListener("click", async ()=>{
    if(!confirm(`Arquivar "${card.name}"?`)) return;
    await apiPut(`/cards/${card.id}`, { closed:true });
    alert("📦 Card arquivado!");
    document.getElementById("loadTreeView").click();
  });

  details.querySelector(".btn-delete").addEventListener("click", async ()=>{
    if(!confirm(`Excluir "${card.name}"?`)) return;
    await apiDelete(`/cards/${card.id}`);
    alert("🗑️ Card excluído!");
    document.getElementById("loadTreeView").click();
  });

  details.querySelector(".btn-move").addEventListener("click", async ()=>{
    const boardChoice = prompt("Mover para qual quadro?\n" + globalData.boards.map((b,i)=>`${i+1}. ${b.name}`).join("\n"));
    if(!boardChoice) return;
    const targetBoard = globalData.boards[parseInt(boardChoice,10)-1];
    if(!targetBoard) return;

    const targetLists = await apiGet(`/boards/${targetBoard.id}/lists`);
    const listChoice = prompt("Mover para qual lista?\n" + targetLists.map((l,i)=>`${i+1}. ${l.name}`).join("\n"));
    const targetList = targetLists[parseInt(listChoice,10)-1];
    if(!targetList) return;

    await apiPut(`/cards/${card.id}`, { idBoard:targetBoard.id, idList:targetList.id });
    alert(`✅ Movido para ${targetList.name}`);
    document.getElementById("loadTreeView").click();
  });

  cardNode.appendChild(details);
}
