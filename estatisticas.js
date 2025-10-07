const apiKey = "4ba1b3a8270aa12804e3ea96f5af088c";
const apiToken = "ATTAc15f31b2e807164ed11400ce511dc02f27d2c5e4a5bbedc6c8e897c7e378b377A2530AE5";
const apiBase = "https://api.trello.com/1";

const boardSelect = document.getElementById("boardSelect");
const treeBtn = document.getElementById("loadTreeView");
const treeContainer = document.getElementById("treeContainer");
const filterArea = document.getElementById("filterArea");
const labelFilter = document.getElementById("labelFilter");
const searchInput = document.getElementById("searchInput");

async function apiGet(endpoint) {
  const sep = endpoint.includes("?") ? "&" : "?";
  const url = `${apiBase}${endpoint}${sep}key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPut(endpoint, body = {}) {
  const url = `${apiBase}${endpoint}?key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(endpoint) {
  const url = `${apiBase}${endpoint}?key=${apiKey}&token=${apiToken}`;
  const res = await fetch(url, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return true;
}
function trelloColor(colorName) {
  const map = {
    green:"#61BD4F", yellow:"#F2D600", orange:"#FF9F1A", red:"#EB5A46",
    purple:"#C377E0", blue:"#0079BF", sky:"#00C2E0", lime:"#51E898",
    pink:"#FF78CB", black:"#4D4D4D"
  };
  return map[colorName] || "#B6BBBF";
}

async function loadBoards() {
  const boards = await apiGet(`/members/me/boards`);
  boardSelect.innerHTML = boards.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
}
loadBoards();

let globalData = { boards: [], lists: [], cards: [], members: [], labels: [] };

treeBtn.addEventListener("click", async () => {
  const boardId = boardSelect.value;
  if (!boardId) return alert("Selecione um quadro primeiro.");

  treeContainer.innerHTML = `<p style="text-align:center;">⏳ Carregando...</p>`;

  const [boards, lists, cards, members, labels] = await Promise.all([
    apiGet(`/members/me/boards`),
    apiGet(`/boards/${boardId}/lists`),
    apiGet(`/boards/${boardId}/cards?fields=id,name,desc,idList,idMembers,idLabels,shortUrl,pos`),
    apiGet(`/boards/${boardId}/members`),
    apiGet(`/boards/${boardId}/labels`)
  ]);

  globalData = { boards, lists, cards, members, labels };

  labelFilter.innerHTML =
    `<option value="all">Todas</option>` +
    labels.map(l => `<option value="${l.id}" style="color:${trelloColor(l.color)};">${l.name || l.color}</option>`).join('');
  filterArea.style.display = "block";

  renderTree();
});

labelFilter.addEventListener("change", renderTree);
searchInput?.addEventListener("input", renderTree);

function renderTree() {
  const { boards, lists, cards, members, labels } = globalData;
  const filterValue = labelFilter.value;
  const searchTerm = searchInput?.value?.toLowerCase() || "";

  let filteredCards = cards;
  if (filterValue !== "all") filteredCards = filteredCards.filter(c => c.idLabels.includes(filterValue));
  if (searchTerm) filteredCards = filteredCards.filter(c => c.name.toLowerCase().includes(searchTerm));

  treeContainer.innerHTML = "";
  const tree = document.createElement("ul");
  tree.className = "tree";

  lists.forEach(list => {
    const listNode = document.createElement("li");
    listNode.className = "list-node";
    listNode.dataset.listId = list.id;

    const toggleBtn = document.createElement("span");
    toggleBtn.className = "toggle-btn";
    toggleBtn.textContent = "▼";
    toggleBtn.onclick = () => {
      const cardsEl = listNode.querySelector("ul");
      if (cardsEl.style.display === "none") {
        cardsEl.style.display = "block";
        toggleBtn.textContent = "▼";
      } else {
        cardsEl.style.display = "none";
        toggleBtn.textContent = "▶";
      }
    };

    const title = document.createElement("span");
    title.className = "list-title";
    title.textContent = `${list.name}`;

    listNode.appendChild(toggleBtn);
    listNode.appendChild(title);

    const cardList = document.createElement("ul");
    const listCards = filteredCards.filter(c => c.idList === list.id).sort((a,b)=>a.pos - b.pos);

    listCards.forEach(card => {
      const cardNode = document.createElement("li");
      cardNode.className = "card-node";
      cardNode.dataset.cardId = card.id;
      cardNode.dataset.pos = card.pos;
      cardNode.innerHTML = `<span class="card-title">📄 ${card.name}</span>`;

      const titleSpan = cardNode.querySelector(".card-title");

      // ===== Edição por duplo clique =====
      const enableEdit = () => {
        const oldName = card.name;
        const input = document.createElement("input");
        input.type = "text";
        input.className = "card-edit";
        input.value = oldName;
        titleSpan.replaceWith(input);
        input.focus();

        const save = async () => {
          const newName = input.value.trim();
          if (newName && newName !== oldName) {
            await apiPut(`/cards/${card.id}`, { name: newName });
            card.name = newName;
          }
          const newSpan = document.createElement("span");
          newSpan.className = "card-title";
          newSpan.textContent = `📄 ${card.name}`;
          input.replaceWith(newSpan);
          newSpan.addEventListener("dblclick", enableEdit);
          newSpan.addEventListener("click", showDetails);
        };

        input.addEventListener("blur", save);
        input.addEventListener("keydown", (e) => e.key === "Enter" && save());
      };

      // ===== Exibir detalhes =====
      const showDetails = () => {
        const existing = cardNode.querySelector(".card-details");
        if (existing) return existing.remove();

        const details = document.createElement("div");
        details.className = "card-details";

        const memberNames = card.idMembers.map(id => members.find(m => m.id === id)?.fullName || "")
          .filter(Boolean)
          .join(", ") || "Sem membros";
        const labelHTML = card.idLabels.map(id => labels.find(l => l.id === id))
          .filter(Boolean)
          .map(l => `<span class="label" style="background:${trelloColor(l.color)};">${l.name || " "}</span>`)
          .join(" ") || "(sem etiquetas)";

        details.innerHTML = `
          <p><strong>Membros:</strong> ${memberNames}</p>
          <p><strong>Etiquetas:</strong> ${labelHTML}</p>
          <p><strong>Descrição:</strong><br>${card.desc || "(sem descrição)"}</p>
          <p><a href="${card.shortUrl}" target="_blank">🔗 Abrir no Trello</a></p>
          <div class="actions">
            <button class="btn-move">🔁 Alterar Local</button>
            <button class="btn-archive">📦 Arquivar</button>
            <button class="btn-delete">🗑️ Excluir</button>
          </div>
        `;

        details.querySelector(".btn-archive").addEventListener("click", async () => {
          if (!confirm(`Arquivar "${card.name}"?`)) return;
          await apiPut(`/cards/${card.id}/closed`, { value: true });
          alert("📦 Card arquivado!");
          treeBtn.click();
        });
        details.querySelector(".btn-delete").addEventListener("click", async () => {
          if (!confirm(`Excluir "${card.name}"?`)) return;
          await apiDelete(`/cards/${card.id}`);
          alert("🗑️ Card excluído!");
          treeBtn.click();
        });
        details.querySelector(".btn-move").addEventListener("click", async () => {
          const boardChoice = prompt("Mover para qual quadro?\n" + boards.map((b,i)=>`${i+1}. ${b.name}`).join("\n"));
          if (!boardChoice) return;
          const targetBoard = boards[parseInt(boardChoice)-1];
          const targetLists = await apiGet(`/boards/${targetBoard.id}/lists`);
          const listChoice = prompt("Mover para qual lista?\n" + targetLists.map((l,i)=>`${i+1}. ${l.name}`).join("\n"));
          const targetList = targetLists[parseInt(listChoice)-1];
          await apiPut(`/cards/${card.id}`, { idBoard: targetBoard.id, idList: targetList.id });
          alert(`✅ Movido para ${targetList.name}`);
          treeBtn.click();
        });

        cardNode.appendChild(details);
      };

      titleSpan.addEventListener("dblclick", enableEdit);
      titleSpan.addEventListener("click", showDetails);

      cardList.appendChild(cardNode);
    });

    Sortable.create(cardList, {
      group: "shared",
      animation: 150,
      ghostClass: "sortable-ghost",
      chosenClass: "sortable-chosen",
      onEnd: async (evt) => {
        const cardId = evt.item.dataset.cardId;
        const newListId = evt.to.closest(".list-node").dataset.listId;
        const before = evt.item.previousElementSibling;
        const after = evt.item.nextElementSibling;
        let pos = "bottom";
        if (before && before.dataset.pos && after && after.dataset.pos)
          pos = (parseFloat(before.dataset.pos) + parseFloat(after.dataset.pos)) / 2;
        else if (before && before.dataset.pos) pos = parseFloat(before.dataset.pos) + 1;
        else if (after && after.dataset.pos) pos = parseFloat(after.dataset.pos) - 1;
        else pos = "top";
        await apiPut(`/cards/${cardId}`, { idList: newListId, pos });
      }
    });

    listNode.appendChild(cardList);
    tree.appendChild(listNode);
  });

  treeContainer.appendChild(tree);
}
