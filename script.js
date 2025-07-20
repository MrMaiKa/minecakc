
const items = {};
let pastedImageURL = "";

const grid = document.getElementById("craftGrid").querySelector("tbody");
for (let r = 0; r < 9; r++) {
  const tr = document.createElement("tr");
  for (let c = 0; c < 9; c++) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    td.appendChild(input);
    tr.appendChild(td);
  }
  grid.appendChild(tr);
}

document.getElementById("pasteArea").addEventListener("paste", function(event) {
  const itemsClipboard = event.clipboardData.items;
  for (const item of itemsClipboard) {
    if (item.type.indexOf("image") === 0) {
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = function(e) {
        pastedImageURL = e.target.result;
        document.getElementById("pasteArea").innerHTML = `<img src="${pastedImageURL}" />`;
      };
      reader.readAsDataURL(blob);
    }
  }
});

function getGridRecipe() {
  const rows = grid.querySelectorAll("tr");
  return Array.from(rows).map(tr =>
    Array.from(tr.querySelectorAll("input")).map(inp => inp.value.trim())
  );
}

function addItem() {
  const name = document.getElementById("itemName").value.trim();
  const id = document.getElementById("itemID").value.trim();
  const outputCount = Math.max(1, parseInt(document.getElementById("itemOutputCount").value) || 1);
  const recipeRaw = document.getElementById("itemRecipe").value.trim();
  const gridRecipe = getGridRecipe();

  if (!name || !id) return alert("Имя и ID обязательны!");

  const itemData = {
    id,
    name,
    texture: pastedImageURL || "",
    components: [],
    grid: gridRecipe,
    outputCount
  };

  if (recipeRaw) {
    itemData.components = recipeRaw.split(",").map(part => {
      const [qty, item] = part.split("*");
      return { item: item.trim(), qty: parseInt(qty.trim()) };
    });
  }

  items[id] = itemData;
  renderItemList();

  document.getElementById("itemName").value = "";
  document.getElementById("itemID").value = "";
  document.getElementById("itemRecipe").value = "";
  document.getElementById("itemOutputCount").value = 1;
  document.getElementById("pasteArea").innerHTML = "Вставь изображение сюда";
  pastedImageURL = "";
  grid.querySelectorAll("input").forEach(inp => inp.value = "");
}

function renderItemList() {
  const container = document.getElementById("itemList");
  container.innerHTML = "";

  for (const id in items) {
    const item = items[id];
    const imgHTML = item.texture ? `<img src="${item.texture}" alt="${item.name}" onclick="calculateResources('${id}')" style="cursor:pointer;" />` : "";
    const recipeText = item.components?.length > 0
      ? item.components.map(c => `${c.qty}*${c.item}`).join(", ")
      : "Рецепт через 9x9-сетку";
    const outputText = item.outputCount && item.outputCount > 1 ? ` (выход: ${item.outputCount})` : '';
    const entry = document.createElement("div");
    entry.className = "item-preview";
    entry.innerHTML = `<strong> ${imgHTML} ${item.name}</strong> [${id}] ${outputText}<br>Рецепт: ${recipeText}<br>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Удалить";
    deleteBtn.onclick = () => {
      if (confirm(`Удалить предмет ${item.name}?`)) {
        delete items[id];
        renderItemList();
      }
    };
    entry.appendChild(deleteBtn);

    const editBtn = document.createElement("button");
    editBtn.textContent = "Редактировать";
    editBtn.onclick = () => {
      document.getElementById("itemName").value = item.name;
      document.getElementById("itemID").value = item.id;
      document.getElementById("itemOutputCount").value = item.outputCount || 1;
      document.getElementById("pasteArea").innerHTML = item.texture ? `<img src="${item.texture}" />` : "Вставь изображение сюда";
      pastedImageURL = item.texture || "";
      grid.querySelectorAll("input").forEach((inp, i) => {
        const r = Math.floor(i / 9);
        const c = i % 9;
        inp.value = item.grid?.[r]?.[c] || "";
      });
    };
    entry.appendChild(editBtn);

    entry.addEventListener("click", () => calculateResources(id));
    container.appendChild(entry);
  }
}

function calculateResources(rootId = null) {
  const result = {};

  function normalizeId(input) {
    return Object.keys(items).find(key => input && key.includes(input.trim()));
  }

  function collect(id, multiplier = 1) {
    const cleanId = normalizeId(id);
    if (!cleanId) {
      console.warn('Неизвестный ID:', id);
      result[id] = (result[id] || 0) + multiplier;
      return;
    }

    const item = items[cleanId];
    const outputCount = item.outputCount || 1;
    const normMultiplier = multiplier / outputCount;
    const isGridEmpty = item.grid.every(row => row.every(cell => cell === ""));

    if (item.components.length > 0) {
      for (const comp of item.components) {
        collect(comp.item, comp.qty * normMultiplier);
      }
    } else if (!isGridEmpty) {
      const flat = item.grid.flat().filter(x => x);
      for (const subId of flat) {
        collect(subId, normMultiplier);
      }
    } else {
      result[cleanId] = (result[cleanId] || 0) + multiplier;
    }
  }

  if (rootId) {
    collect(rootId);
  } else {
    const lastId = document.getElementById("itemID").value.trim();
    if (lastId) collect(lastId);
  }

  const lines = Object.entries(result).map(([id, qty]) => {
    const matchedId = normalizeId(id) || id;
    const item = items[matchedId] || { name: matchedId, texture: "" };
    return `<img src="${item.texture}" width="24" /> ${item.name || matchedId} | ${matchedId} | Кол-во: ${qty}`;
  });

  document.getElementById("result").innerHTML = `<h3>Изначальных предметов</h3>` + lines.join("<br>") + `<br><button onclick="exportInitialItems()">Выгрузить в JSON</button>`;
}

function exportInitialItems() {
  const resultDiv = document.getElementById("result");
  const lines = resultDiv.innerHTML.split("<br>").slice(1); // пропускаем заголовок
  const exportObj = {};
  for (const line of lines) {
    const matches = line.match(/\|\s(.+?)\s\|\sКол-во:\s([\d.]+)/);
    if (matches) {
      const id = matches[1].trim();
      const qty = Math.ceil(parseFloat(matches[2]));
      exportObj[id] = qty;
    }
  }
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "initial_items.json";
  a.click();
}

function exportData() {
  const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "minecraft_craft_data.json";
  a.click();
}

async function saveDataToSite() {
  const data = JSON.stringify(items, null, 2);
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'minecraft_craft_data (20).json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
      alert('Файл обновлен');
      return;
    } catch (err) {
      console.error('File save canceled or failed', err);
    }
  }
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'minecraft_craft_data (20).json';
  a.click();
}

function clearData() {
  for (const key in items) {
    delete items[key];
  }
  renderItemList();
}

function importData(event) {
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = () => {
    const data = JSON.parse(reader.result);
    Object.assign(items, data);
    renderItemList();
  };
  reader.readAsText(file);
}

function loadFromSite() {
  fetch('minecraft_craft_data (20).json')
    .then(r => r.json())
    .then(data => {
      Object.assign(items, data);
      renderItemList();
    })
    .catch(err => console.error('Error loading default data:', err));
}

document.addEventListener('DOMContentLoaded', () => {
  loadFromSite();
});


document.addEventListener("DOMContentLoaded", function () {
  const scrollBtn = document.getElementById("scrollTopBtn");
  if (scrollBtn) {
    scrollBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});


document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.getElementById("itemSearch");
  const searchBtn = document.getElementById("searchItemBtn");
  if (searchInput && searchBtn) {
    searchBtn.addEventListener("click", function () {
      const filter = searchInput.value.toLowerCase();
      const items = document.querySelectorAll(".item-preview");
      for (const item of items) {
        const text = item.textContent.toLowerCase();
        if (text.includes(filter)) {
          item.scrollIntoView({ behavior: 'smooth', block: 'center' });
          break;
        }
      }
    });
  }
});


document.addEventListener("DOMContentLoaded", function () {
  let typed = '';
  const popup = document.getElementById("minecraftPopup");
  const closeBtn = document.getElementById("closePopupBtn");
  const yuhu = document.getElementById("soundYuhu");
  const ohyeah = document.getElementById("soundOhYeah");

  document.addEventListener("keydown", function (e) {
    if (e.key.length === 1) {
      typed += e.key.toLowerCase();
      if (typed.includes("майн")) {
        if (popup) popup.style.display = "flex";
        if (yuhu) yuhu.play();
        typed = '';
      }
      if (typed.length > 10) typed = typed.slice(-10);
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      if (popup) popup.style.display = "none";
      if (ohyeah) ohyeah.play();
    });
  }
});
