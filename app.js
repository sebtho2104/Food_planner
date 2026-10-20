// ===== Middagsmaskinen =====
// All data is saved in the browser's localStorage. No server, no accounts.

const UNITS = ["g", "kg", "ml", "dl", "l", "pcs", "tbsp", "tsp", "pinch"];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const SKIP_DAYS = 3; // don't suggest a meal eaten in the last 3 days

// ---------- Storage ----------

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("Could not save", key);
  }
}

let meals = load("meals", []);         // [{ id, name, ingredients: [{ name, amount, unit }] }]
let history = load("history", []);     // [{ mealId, date }]
let week = load("week", []);           // [mealId or null] x 7
let shopping = load("shopping", []);   // [{ name, amount, unit, done }]

let tonightPick = null;  // meal id currently shown on the Tonight tab
let editingId = null;    // meal id being edited, or null when adding

// ---------- Helpers ----------

function findMeal(id) {
  return meals.find(m => m.id === id);
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Convert to a base unit so "500 g" + "1 kg" can be added together
function toBase(amount, unit) {
  if (unit === "kg") return { amount: amount * 1000, unit: "g" };
  if (unit === "l") return { amount: amount * 1000, unit: "ml" };
  if (unit === "dl") return { amount: amount * 100, unit: "ml" };
  return { amount, unit };
}

// Turn base units back into something readable (1500 g -> 1.5 kg)
function prettyAmount(amount, unit) {
  if (unit === "g" && amount >= 1000) return round(amount / 1000) + " kg";
  if (unit === "ml" && amount >= 1000) return round(amount / 1000) + " l";
  if (unit === "ml" && amount >= 100) return round(amount / 100) + " dl";
  return round(amount) + " " + unit;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function formatIngredient(ing) {
  return ing.amount + " " + ing.unit + " " + ing.name;
}

// ---------- Tabs ----------

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// ---------- Meal library ----------

function renderMeals() {
  const list = document.getElementById("meal-list");

  if (meals.length === 0) {
    list.innerHTML = '<p class="empty">No meals yet. Add your first one!</p>';
    return;
  }

  list.innerHTML = meals.map(meal => `
    <div class="card">
      <div class="card-header">
        <h3>${escapeHtml(meal.name)}</h3>
        <div class="card-actions">
          <button class="small secondary" onclick="openMealDialog('${meal.id}')">Edit</button>
          <button class="small secondary" onclick="deleteMeal('${meal.id}')">Delete</button>
        </div>
      </div>
      <ul class="ingredients">
        ${meal.ingredients.map(i => `<li>${escapeHtml(formatIngredient(i))}</li>`).join("")}
      </ul>
    </div>
  `).join("");
}

function deleteMeal(id) {
  const meal = findMeal(id);
  if (!meal || !confirm(`Delete "${meal.name}"?`)) return;

  meals = meals.filter(m => m.id !== id);
  week = week.map(w => (w === id ? null : w));
  if (tonightPick === id) tonightPick = null;

  save("meals", meals);
  save("week", week);
  renderAll();
}

// ---------- Add / edit meal dialog ----------

const dialog = document.getElementById("meal-dialog");
const rowsBox = document.getElementById("ingredient-rows");
const errorBox = document.getElementById("form-error");

function addIngredientRow(ing) {
  ing = ing || { name: "", amount: "", unit: "g" };

  const row = document.createElement("div");
  row.className = "ingredient-row";
  row.innerHTML = `
    <input class="ing-name" type="text" placeholder="Ingredient" maxlength="40">
    <input class="ing-amount" type="number" placeholder="Qty" min="0" step="any">
    <select class="ing-unit">
      ${UNITS.map(u => `<option value="${u}">${u}</option>`).join("")}
    </select>
    <button type="button" title="Remove">✕</button>
  `;
  row.querySelector(".ing-name").value = ing.name;
  row.querySelector(".ing-amount").value = ing.amount;
  row.querySelector(".ing-unit").value = ing.unit;
  row.querySelector("button").addEventListener("click", () => row.remove());

  rowsBox.appendChild(row);
}

function openMealDialog(id) {
  editingId = id || null;
  const meal = id ? findMeal(id) : null;

  document.getElementById("dialog-title").textContent = meal ? "Edit meal" : "Add meal";
  document.getElementById("meal-name").value = meal ? meal.name : "";
  errorBox.textContent = "";
  rowsBox.innerHTML = "";

  if (meal) {
    meal.ingredients.forEach(addIngredientRow);
  } else {
    addIngredientRow();
    addIngredientRow();
  }

  dialog.showModal();
}

function readForm() {
  const name = document.getElementById("meal-name").value.trim();
  if (!name) return { error: "Give the meal a name." };

  const ingredients = [];
  for (const row of rowsBox.querySelectorAll(".ingredient-row")) {
    const ingName = row.querySelector(".ing-name").value.trim();
    const amountText = row.querySelector(".ing-amount").value;
    const unit = row.querySelector(".ing-unit").value;

    if (!ingName && !amountText) continue; // skip empty rows

    const amount = parseFloat(amountText);
    if (!ingName) return { error: "Every ingredient needs a name." };
    if (isNaN(amount) || amount <= 0) return { error: `"${ingName}" needs an amount above 0.` };

    ingredients.push({ name: ingName, amount, unit });
  }

  if (ingredients.length === 0) return { error: "Add at least one ingredient." };

  const duplicate = meals.find(m => m.name.toLowerCase() === name.toLowerCase() && m.id !== editingId);
  if (duplicate) return { error: `You already have a meal called "${duplicate.name}".` };

  return { name, ingredients };
}

document.getElementById("add-meal").addEventListener("click", () => openMealDialog());
document.getElementById("add-ingredient").addEventListener("click", () => addIngredientRow());
document.getElementById("cancel-meal").addEventListener("click", () => dialog.close());

document.getElementById("meal-form").addEventListener("submit", event => {
  event.preventDefault();
  const result = readForm();

  if (result.error) {
    errorBox.textContent = result.error;
    return;
  }

  if (editingId) {
    const meal = findMeal(editingId);
    meal.name = result.name;
    meal.ingredients = result.ingredients;
  } else {
    meals.push({ id: newId(), name: result.name, ingredients: result.ingredients });
  }

  save("meals", meals);
  dialog.close();
  renderAll();
});

// ---------- Tonight ----------

function recentlyEaten() {
  const cutoff = Date.now() - SKIP_DAYS * 24 * 60 * 60 * 1000;
  return history.filter(h => new Date(h.date).getTime() >= cutoff).map(h => h.mealId);
}

function pickTonight() {
  if (meals.length === 0) {
    tonightPick = null;
    renderTonight("Add some meals first in the Meals tab.");
    return;
  }

  const recent = recentlyEaten();
  let options = meals.filter(m => !recent.includes(m.id));
  let note = "";

  if (options.length === 0) {
    options = meals;
    note = "You've had everything recently, so anything goes!";
  }

  // Avoid showing the same meal twice in a row when rerolling
  if (options.length > 1 && tonightPick) {
    options = options.filter(m => m.id !== tonightPick);
  }

  tonightPick = randomItem(options).id;
  renderTonight(note);
}

function acceptTonight() {
  const meal = findMeal(tonightPick);
  if (!meal) return;

  history.push({ mealId: meal.id, date: new Date().toISOString() });
  save("history", history);
  addToShopping([meal]);

  renderTonight(`Added ${meal.ingredients.length} ingredients to the shopping list. Enjoy!`, true);
}

function renderTonight(message, accepted) {
  const box = document.getElementById("tonight-result");
  const meal = findMeal(tonightPick);

  if (!meal) {
    box.innerHTML = message ? `<p class="empty">${escapeHtml(message)}</p>` : "";
    return;
  }

  box.innerHTML = `
    <div class="card pick">
      <div>Tonight's dinner is…</div>
      <div class="meal-title">${escapeHtml(meal.name)}</div>
      <ul class="ingredients" style="text-align:left; display:inline-block;">
        ${meal.ingredients.map(i => `<li>${escapeHtml(formatIngredient(i))}</li>`).join("")}
      </ul>
      ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
      ${accepted ? "" : `
        <div class="buttons">
          <button class="secondary" onclick="pickTonight()">🔄 Reroll</button>
          <button onclick="acceptTonight()">✅ Let's eat this</button>
        </div>`}
    </div>
  `;
}

document.getElementById("pick-tonight").addEventListener("click", pickTonight);

// ---------- Week ----------

function pickWeek() {
  if (meals.length === 0) {
    week = [];
    save("week", week);
    renderWeek("Add some meals first in the Meals tab.");
    return;
  }

  // Shuffle the meals and repeat the list if there are fewer than 7
  let pool = [];
  while (pool.length < 7) {
    pool = pool.concat(shuffle(meals).map(m => m.id));
  }

  // Avoid the same meal two days in a row (possible when the list repeats)
  for (let i = 1; i < 7; i++) {
    if (pool[i] === pool[i - 1] && meals.length > 1) {
      const swapWith = pool.findIndex((id, j) => j > i && id !== pool[i]);
      if (swapWith !== -1) [pool[i], pool[swapWith]] = [pool[swapWith], pool[i]];
    }
  }

  week = pool.slice(0, 7);
  save("week", week);
  renderWeek();
}

function rerollDay(index) {
  const neighbours = [week[index - 1], week[index + 1]];
  let options = meals.filter(m => m.id !== week[index] && !neighbours.includes(m.id));
  if (options.length === 0) options = meals.filter(m => m.id !== week[index]);
  if (options.length === 0) options = meals;

  week[index] = randomItem(options).id;
  save("week", week);
  renderWeek();
}

function weekToShopping() {
  const weekMeals = week.map(findMeal).filter(Boolean);
  addToShopping(weekMeals);
  renderWeek("Whole week added to the shopping list!");
}

function renderWeek(message) {
  const list = document.getElementById("week-list");
  const shopBtn = document.getElementById("week-to-shopping");

  if (week.length === 0) {
    list.innerHTML = `<p class="empty">${escapeHtml(message || "Press the button to plan your week.")}</p>`;
    shopBtn.classList.add("hidden");
    return;
  }

  list.innerHTML = DAYS.map((day, i) => {
    const meal = findMeal(week[i]);
    return `
      <div class="card day-row">
        <span class="day-name">${day}</span>
        <span class="day-meal">${meal ? escapeHtml(meal.name) : "<em>—</em>"}</span>
        <button class="small secondary" onclick="rerollDay(${i})" title="Pick another">🔄</button>
      </div>`;
  }).join("") + (message ? `<p class="notice">${escapeHtml(message)}</p>` : "");

  shopBtn.classList.remove("hidden");
}

document.getElementById("pick-week").addEventListener("click", pickWeek);
document.getElementById("week-to-shopping").addEventListener("click", weekToShopping);

// ---------- Shopping list ----------

function addToShopping(mealList) {
  mealList.forEach(meal => {
    meal.ingredients.forEach(ing => {
      const base = toBase(ing.amount, ing.unit);
      const existing = shopping.find(s =>
        s.name.toLowerCase() === ing.name.toLowerCase() && s.unit === base.unit
      );

      if (existing) {
        existing.amount += base.amount;
        existing.done = false;
      } else {
        shopping.push({ name: ing.name, amount: base.amount, unit: base.unit, done: false });
      }
    });
  });

  save("shopping", shopping);
  renderShopping();
}

function toggleItem(index) {
  shopping[index].done = !shopping[index].done;
  save("shopping", shopping);
  renderShopping();
}

function renderShopping() {
  const list = document.getElementById("shopping-list");
  const clearBtn = document.getElementById("clear-shopping");

  if (shopping.length === 0) {
    list.innerHTML = '<p class="empty">Shopping list is empty.</p>';
    clearBtn.classList.add("hidden");
    return;
  }

  list.innerHTML = '<div class="card">' + shopping.map((item, i) => `
    <label class="shop-item ${item.done ? "done" : ""}">
      <input type="checkbox" ${item.done ? "checked" : ""} onchange="toggleItem(${i})">
      <span>${escapeHtml(prettyAmount(item.amount, item.unit))} ${escapeHtml(item.name)}</span>
    </label>
  `).join("") + "</div>";

  clearBtn.classList.remove("hidden");
}

document.getElementById("clear-shopping").addEventListener("click", () => {
  if (!confirm("Clear the whole shopping list?")) return;
  shopping = [];
  save("shopping", shopping);
  renderShopping();
});

// ---------- Start ----------

function renderAll() {
  renderMeals();
  renderTonight();
  renderWeek();
  renderShopping();
}

renderAll();
