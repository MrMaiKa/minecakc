
const items = {};
let pastedImageURL = "";

const grid = document.getElementById("craftGrid").querySelector("tbody");
for (let r = 0; r < 9; r++) {
  const tr = document.createElement("tr");
  for (let c = 0; c < 9; c++) {
    const td = document.createElement("td");
    const input = document.createElement("input");
    input.addEventListener("input", () => updateCellImage(input));
    td.appendChild(input);
    tr.appendChild(td);
  }
  grid.appendChild(tr);
}

function updateCellImage(input) {
  const val = input.value.trim();
  const item = items[val];
  if (item && item.texture) {
    input.style.backgroundImage = `url(${item.texture})`;
    input.style.backgroundSize = "cover";
    input.style.backgroundPosition = "center";
    input.style.backgroundRepeat = "no-repeat";
  } else {
    input.style.backgroundImage = "";
  }
}

function toggleManualInput() {
  const label = document.getElementById("itemRecipe").parentElement;
  label.style.display = label.style.display === "none" ? "block" : "none";
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
  grid.querySelectorAll("input").forEach(inp => {
    inp.value = "";
    updateCellImage(inp);
  });
}

function renderItemList() {
  const container = document.getElementById("itemList");
  container.innerHTML = "";

  for (const id in items) {
    const item = items[id];
    const imgHTML = item.texture ? `<img src="${item.texture}" alt="${item.name}" />` : "";
    const hasComponents = item.components?.length > 0;
    const recipeText = hasComponents
      ? item.components.map(c => `${c.qty}*${c.item}`).join(", ")
      : "";
    const outputText = item.outputCount && item.outputCount > 1 ? ` (выход: ${item.outputCount})` : '';
    const entry = document.createElement("div");
    entry.className = "item-preview";
    entry.innerHTML = `<strong class="item-header"> ${imgHTML} ${item.name}</strong> [${id}] ${outputText}`;
    if (recipeText) {
      entry.innerHTML += `<br>Рецепт: ${recipeText}`;
    }
    entry.innerHTML += "<br>";

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
        updateCellImage(inp);
      });
    };
    entry.appendChild(editBtn);

    const header = entry.querySelector(".item-header");
    if (header) {
      header.style.cursor = "pointer";
      header.addEventListener("click", () => calculateResources(id));
    }

    container.appendChild(entry);
  }
}

function calculateResources(rootId = null) {
  const result = {};

function normalizeId(input) {
  if (!input) return null;
  const needle = input.trim();
  const keys = Object.keys(items);

  // 1) точное совпадение с учётом регистра
  let k = keys.find(k => k === needle);
  if (k) return k;

  // 2) точное совпадение без учёта регистра
  const low = needle.toLowerCase();
  k = keys.find(k => k.toLowerCase() === low);
  if (k) return k;

  // 3) частичное совпадение без учёта регистра
  k = keys.find(k => k.toLowerCase().includes(low));
  return k || null;
}

  const baseCache = {};
  function getBaseCounts(id, visited = new Set()) {
    const cleanId = normalizeId(id);
    if (!cleanId) {
      return { [id]: 1 };
    }
    if (baseCache[cleanId]) return baseCache[cleanId];
    if (visited.has(cleanId)) return {};
    visited.add(cleanId);

    const item = items[cleanId];
    const outputCount = item.outputCount || 1;
    const normMultiplier = 1 / outputCount;
    const isGridEmpty = item.grid.every(row => row.every(cell => cell === ""));

    const base = {};
    if (item.components.length > 0) {
      for (const comp of item.components) {
        const sub = getBaseCounts(comp.item, visited);
        for (const k in sub) {
          base[k] = (base[k] || 0) + sub[k] * comp.qty * normMultiplier;
        }
      }
    } else if (!isGridEmpty) {
      const flat = item.grid.flat().filter(x => x);
      for (const subId of flat) {
        const sub = getBaseCounts(subId, visited);
        for (const k in sub) {
          base[k] = (base[k] || 0) + sub[k] * normMultiplier;
        }
      }
    } else {
      base[cleanId] = normMultiplier;
    }

    baseCache[cleanId] = base;
    visited.delete(cleanId);
    return base;
  }

  function addToResult(map, multiplier = 1) {
    for (const k in map) {
      result[k] = (result[k] || 0) + map[k] * multiplier;
    }
  }

  if (rootId) {
    addToResult(getBaseCounts(rootId));
  } else {
    const lastId = document.getElementById("itemID").value.trim();
    if (lastId) addToResult(getBaseCounts(lastId));
  }

const linesHtml = Object.entries(result).map(([rid, qty]) => {
  const matchedId = normalizeId(rid) || rid;
  const item = items[matchedId] || { name: matchedId, texture: "" };
  const safeName = item.name || matchedId;
  const img = item.texture ? `<img src="${item.texture}" width="24" />` : "";
  return `<div class="res-line" data-id="${matchedId}" data-qty="${qty}">
            ${img} ${safeName} | ${matchedId} | Кол-во: ${qty}
          </div>`;
}).join("");

document.getElementById("result").innerHTML =
  `<h3>Изначальных предметов</h3>${linesHtml}<br><button onclick="exportInitialItems()">Выгрузить в JSON</button>`;
}

function exportInitialItems() {
  const lines = Array.from(document.querySelectorAll("#result .res-line"));
  const exportArr = lines.map(div => {
    const id = div.getAttribute("data-id"); // регистр сохраняется
    const qty = Math.ceil(parseFloat(div.getAttribute("data-qty") || "0"));
    return { id: id.replace(/[<>]/g, ""), count: qty };
  }).filter(x => x.id && x.count > 0);

  const blob = new Blob([JSON.stringify(exportArr, null, 2)], { type: "application/json" });
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
  try {
    const response = await fetch('minecraft_craft_data (20).json', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data
    });
    if (!response.ok) throw new Error('Server error: ' + response.status);
    alert('Файл на сайте обновлен');
  } catch (err) {
    console.error('Error saving data to site:', err);
    alert('Не удалось обновить файл на сайте');
  }
}

function downloadCraftsFile() {
  const fileName = 'minecraft_craft_data (20).json';
  fetch(encodeURI(fileName))
    .then(r => r.blob())
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(err => console.error('Error downloading file:', err));
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
