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
    alert("Couldn't save. The browser storage is full. Try fewer or smaller uploaded photos.");
  }
}

let meals = load("meals", []);         // [{ id, name, ingredients: [{ name, amount, unit }] }]
let history = load("history", []);     // [{ mealId, date }]
let week = load("week", []);           // [mealId or null] x 7
let shopping = load("shopping", []);   // [{ name, amount, unit, done }]

// ---------- Starter meals ----------
// Added once, so the app isn't empty the first time someone opens it.
// Meals with the same name as one you already have are skipped.

const PHOTO = "https://www.themealdb.com/images/media/meals/";

const STARTER_MEALS = [
  { name: "Taco", photo: PHOTO + "ypxvwv1505333929.jpg", ingredients: [
    { name: "Minced beef", amount: 400, unit: "g" },
    { name: "Tortillas", amount: 8, unit: "pcs" },
    { name: "Taco spice", amount: 1, unit: "pcs" },
    { name: "Grated cheese", amount: 150, unit: "g" },
    { name: "Sour cream", amount: 3, unit: "dl" },
    { name: "Tomatoes", amount: 2, unit: "pcs" },
    { name: "Iceberg lettuce", amount: 1, unit: "pcs" }] },
  { name: "Spaghetti Bolognese", photo: PHOTO + "sutysw1468247559.jpg", ingredients: [
    { name: "Spaghetti", amount: 400, unit: "g" },
    { name: "Minced beef", amount: 400, unit: "g" },
    { name: "Chopped tomatoes", amount: 400, unit: "g" },
    { name: "Onion", amount: 1, unit: "pcs" },
    { name: "Garlic", amount: 2, unit: "pcs" },
    { name: "Parmesan", amount: 50, unit: "g" }] },
  { name: "Lasagne", photo: PHOTO + "wtsvxx1511296896.jpg", ingredients: [
    { name: "Lasagne sheets", amount: 250, unit: "g" },
    { name: "Minced beef", amount: 500, unit: "g" },
    { name: "Chopped tomatoes", amount: 800, unit: "g" },
    { name: "Milk", amount: 5, unit: "dl" },
    { name: "Butter", amount: 50, unit: "g" },
    { name: "Flour", amount: 3, unit: "tbsp" },
    { name: "Grated cheese", amount: 200, unit: "g" }] },
  { name: "Fiskesuppe", photo: PHOTO + "raqjbj1762773035.jpg", ingredients: [
    { name: "Salmon", amount: 300, unit: "g" },
    { name: "Cod", amount: 300, unit: "g" },
    { name: "Carrots", amount: 2, unit: "pcs" },
    { name: "Leek", amount: 1, unit: "pcs" },
    { name: "Fish stock", amount: 1, unit: "l" },
    { name: "Cream", amount: 3, unit: "dl" }] },
  { name: "Chicken Curry", photo: PHOTO + "yxsurp1511304301.jpg", ingredients: [
    { name: "Chicken breast", amount: 500, unit: "g" },
    { name: "Coconut milk", amount: 400, unit: "ml" },
    { name: "Curry paste", amount: 2, unit: "tbsp" },
    { name: "Onion", amount: 1, unit: "pcs" },
    { name: "Rice", amount: 300, unit: "g" }] },
  { name: "Teriyaki Salmon", photo: PHOTO + "xxyupu1468262513.jpg", ingredients: [
    { name: "Salmon", amount: 500, unit: "g" },
    { name: "Teriyaki sauce", amount: 1, unit: "dl" },
    { name: "Broccoli", amount: 1, unit: "pcs" },
    { name: "Rice", amount: 300, unit: "g" }] },
  { name: "Pizza Margherita", photo: PHOTO + "x0lk931587671540.jpg", ingredients: [
    { name: "Flour", amount: 500, unit: "g" },
    { name: "Yeast", amount: 12, unit: "g" },
    { name: "Tomato sauce", amount: 2, unit: "dl" },
    { name: "Mozzarella", amount: 250, unit: "g" },
    { name: "Basil", amount: 1, unit: "pcs" }] },
  { name: "Pancakes", photo: PHOTO + "rwuyqx1511383174.jpg", ingredients: [
    { name: "Flour", amount: 3, unit: "dl" },
    { name: "Milk", amount: 6, unit: "dl" },
    { name: "Eggs", amount: 3, unit: "pcs" },
    { name: "Butter", amount: 30, unit: "g" },
    { name: "Jam", amount: 1, unit: "pcs" }] },
];

function addStarterMeals() {
  if (load("starterMealsAdded", false)) return;

  STARTER_MEALS.forEach(starter => {
    const exists = meals.some(m => m.name.toLowerCase() === starter.name.toLowerCase());
    if (!exists) meals.push({ id: newId(), ...starter });
  });

  save("meals", meals);
  save("starterMealsAdded", true);
}

let tonightPick = null;  // meal id currently shown on the Tonight tab
let editingId = null;    // meal id being edited, or null when adding
let dialogPhoto = null;  // photo (web link or uploaded image) chosen in the popup
let photoRemoved = false; // true if the user removed the photo on purpose
let photoResults = [];   // photos found online for the current meal name
let photoSearchName = "";
let photoIndex = 0;

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
  if (unit === "pcs") return round(amount) + " ×";
  return round(amount) + " " + unit;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

// Photo box for a meal, with a plate emoji when there is no photo
function photoHtml(photo, extraClass) {
  const cls = "photo-box " + (extraClass || "");
  if (!photo) return `<div class="${cls}">🍽️</div>`;
  const src = escapeHtml(photo).replace(/"/g, "&quot;");
  return `<div class="${cls}"><img src="${src}" alt="" loading="lazy" onerror="this.parentElement.textContent='🍽️'"></div>`;
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
    // The "Add meal" button only belongs on the Meals tab
    document.getElementById("add-meal").classList.toggle("hidden", tab.dataset.tab !== "library");
  });
});

// ---------- Meal library ----------

let openMealId = null; // the meal that is expanded in the Meals list

function renderMeals() {
  const list = document.getElementById("meal-list");
  document.getElementById("meal-total").textContent = meals.length;

  if (meals.length === 0) {
    list.innerHTML = '<p class="empty">No meals yet. Press <b>+ Add meal</b> to add your first one!</p>';
    return;
  }

  // Filter by meal name or ingredient
  const query = document.getElementById("meal-search").value.trim().toLowerCase();
  const shown = meals.filter(meal =>
    meal.name.toLowerCase().includes(query) ||
    meal.ingredients.some(i => i.name.toLowerCase().includes(query))
  );

  if (shown.length === 0) {
    list.innerHTML = `<p class="empty">No meals match "${escapeHtml(query)}".</p>`;
    return;
  }

  list.innerHTML = shown.map(meal => `
    <div class="card meal-item ${meal.id === openMealId ? "open" : ""}" data-id="${meal.id}">
      <div class="meal-summary" onclick="toggleMeal('${meal.id}')">
        ${photoHtml(meal.photo, "thumb")}
        <div class="meal-info">
          <div class="meal-name">${escapeHtml(meal.name)}</div>
          <div class="meal-count">${meal.ingredients.length} ingredient${meal.ingredients.length === 1 ? "" : "s"}</div>
        </div>
        <span class="chevron">▾</span>
      </div>
      <div class="meal-details-wrap">
        <div class="meal-details">
          ${photoHtml(meal.photo, "large")}
          <ul class="ingredients">
            ${meal.ingredients.map(i => `<li>${escapeHtml(formatIngredient(i))}</li>`).join("")}
          </ul>
          <div class="card-actions">
            <button class="small" onclick="addMealToShopping('${meal.id}', this)">🛒 Add to shopping list</button>
            <button class="small secondary" onclick="openMealDialog('${meal.id}')">Edit</button>
            <button class="small secondary" onclick="deleteMeal('${meal.id}')">Delete</button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

// Open one meal and close the others (no re-render, so it animates)
function toggleMeal(id) {
  openMealId = openMealId === id ? null : id;
  document.querySelectorAll(".meal-item").forEach(item => {
    item.classList.toggle("open", item.dataset.id === openMealId);
  });
}

document.getElementById("meal-search").addEventListener("input", renderMeals);

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

  dialogPhoto = meal ? meal.photo || null : null;
  photoRemoved = false;
  photoResults = [];
  photoSearchName = "";
  setPhotoStatus("");
  showPhoto();

  if (meal) {
    meal.ingredients.forEach(addIngredientRow);
  } else {
    addIngredientRow();
    addIngredientRow();
  }

  dialog.showModal();
}

// ---------- Photos ----------

function showPhoto() {
  const box = document.getElementById("photo-preview");
  box.innerHTML = dialogPhoto ? `<img src="${dialogPhoto.replace(/"/g, "&quot;")}" alt="">` : "🍽️";
  document.getElementById("remove-photo").classList.toggle("hidden", !dialogPhoto);
}

function setPhotoStatus(text) {
  document.getElementById("photo-status").textContent = text;
}

// Search TheMealDB (free recipe database with photos, public test key "1")
async function searchMealDb(query) {
  const url = "https://www.themealdb.com/api/json/v1/1/search.php?s=" + encodeURIComponent(query);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Search failed");
  const data = await response.json();
  return data.meals || [];
}

// Try the full name first, then single words ("Mammas tacos" -> "tacos")
async function findPhotos(name) {
  const words = name.toLowerCase().split(/\s+/).filter(w => w.length >= 4);
  words.sort((a, b) => b.length - a.length);
  const queries = [name.toLowerCase(), ...words].filter((q, i, all) => all.indexOf(q) === i);

  for (const query of queries) {
    const found = await searchMealDb(query);
    if (found.length === 0) continue;

    // Best match first: exact name, then names starting with the query, then shortest name
    const rank = m => {
      const n = m.strMeal.toLowerCase();
      const level = n === query ? 0 : n.startsWith(query) ? 1 : 2;
      return level * 1000 + n.length;
    };
    found.sort((a, b) => rank(a) - rank(b));
    return found.map(m => ({ name: m.strMeal, url: m.strMealThumb }));
  }
  return [];
}

async function findPhotoClick() {
  const name = document.getElementById("meal-name").value.trim();
  if (!name) {
    setPhotoStatus("Write the meal name first.");
    return;
  }

  if (name !== photoSearchName) {
    setPhotoStatus("Searching…");
    try {
      photoResults = await findPhotos(name);
    } catch (e) {
      setPhotoStatus("Couldn't reach the photo search. Check your internet connection.");
      return;
    }
    photoSearchName = name;
    photoIndex = 0;
  } else if (photoResults.length > 0) {
    // Pressing again shows the next photo
    photoIndex = (photoIndex + 1) % photoResults.length;
  }

  if (photoResults.length === 0) {
    setPhotoStatus(`No photo found for "${name}". Try another name or upload your own.`);
    return;
  }

  const pick = photoResults[photoIndex];
  dialogPhoto = pick.url;
  photoRemoved = false;
  showPhoto();
  setPhotoStatus(`Photo: ${pick.name} (${photoIndex + 1} of ${photoResults.length}). Press again for another.`);
}

// Shrink an uploaded photo so it doesn't fill up the browser storage
function resizeImage(file, maxSize, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      done(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => setPhotoStatus("Couldn't read that image.");
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

document.getElementById("find-photo").addEventListener("click", findPhotoClick);

document.getElementById("photo-upload").addEventListener("change", event => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    setPhotoStatus("That file isn't an image.");
    return;
  }
  resizeImage(file, 600, dataUrl => {
    dialogPhoto = dataUrl;
    photoRemoved = false;
    showPhoto();
    setPhotoStatus("Using your own photo.");
  });
});

document.getElementById("remove-photo").addEventListener("click", () => {
  dialogPhoto = null;
  photoRemoved = true;
  showPhoto();
  setPhotoStatus("");
});

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

document.getElementById("meal-form").addEventListener("submit", async event => {
  event.preventDefault();
  const result = readForm();

  if (result.error) {
    errorBox.textContent = result.error;
    return;
  }

  // No photo chosen? Try to find one automatically
  if (!dialogPhoto && !photoRemoved) {
    const saveBtn = document.getElementById("save-meal");
    saveBtn.disabled = true;
    setPhotoStatus("Looking for a photo…");
    try {
      const found = await findPhotos(result.name);
      if (found.length > 0) dialogPhoto = found[0].url;
    } catch (e) {
      // No internet: just save without a photo
    }
    saveBtn.disabled = false;
  }

  if (editingId) {
    const meal = findMeal(editingId);
    meal.name = result.name;
    meal.ingredients = result.ingredients;
    meal.photo = dialogPhoto;
  } else {
    meals.push({ id: newId(), name: result.name, ingredients: result.ingredients, photo: dialogPhoto });
  }

  save("meals", meals);
  dialog.close();
  renderAll();
});

// ---------- Pick one for me ----------

function recentlyEaten() {
  const cutoff = Date.now() - SKIP_DAYS * 24 * 60 * 60 * 1000;
  return history.filter(h => new Date(h.date).getTime() >= cutoff).map(h => h.mealId);
}

// Remember when a meal was added to the shopping list, so it isn't suggested again right away
function rememberEaten(meal) {
  history.push({ mealId: meal.id, date: new Date().toISOString() });
  save("history", history);
}

function suggestMeal() {
  if (meals.length === 0) {
    tonightPick = null;
    renderSuggestion("Add some meals first.");
    return;
  }

  // Prefer meals you haven't had in the last few days
  const recent = recentlyEaten();
  let options = meals.filter(m => !recent.includes(m.id));
  let note = "";
  if (options.length === 0) {
    options = meals;
    note = "You've had everything recently, so anything goes!";
  }

  // Avoid showing the same meal twice in a row
  if (options.length > 1 && tonightPick) {
    options = options.filter(m => m.id !== tonightPick);
  }

  tonightPick = randomItem(options).id;
  renderSuggestion(note);
}

function acceptSuggestion() {
  const meal = findMeal(tonightPick);
  if (!meal) return;
  rememberEaten(meal);
  addToShopping([meal]);
  tonightPick = null;
  renderSuggestion(`${meal.name} was added to the shopping list. Pick another or add more from the list!`);
}

function skipSuggestion() {
  tonightPick = null;
  renderSuggestion();
}

function renderSuggestion(message) {
  const box = document.getElementById("tonight-result");
  const meal = findMeal(tonightPick);

  if (!meal) {
    box.innerHTML = message ? `<p class="notice">${escapeHtml(message)}</p>` : "";
    return;
  }

  box.innerHTML = `
    <div class="card pick">
      <div class="pick-label">How about…</div>
      ${photoHtml(meal.photo)}
      <div class="meal-title">${escapeHtml(meal.name)}</div>
      <ul class="ingredients" style="text-align:left; display:inline-block;">
        ${meal.ingredients.map(i => `<li>${escapeHtml(formatIngredient(i))}</li>`).join("")}
      </ul>
      ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ""}
      <div class="buttons">
        <button class="secondary" onclick="skipSuggestion()">✕ No thanks</button>
        <button class="secondary" onclick="suggestMeal()">🔄 Another</button>
        <button onclick="acceptSuggestion()">🛒 Take it</button>
      </div>
    </div>
  `;
}

document.getElementById("pick-tonight").addEventListener("click", suggestMeal);

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
        <span class="day-name"><span class="day-long">${day}</span><span class="day-short">${day.slice(0, 3)}</span></span>
        ${meal ? photoHtml(meal.photo, "thumb") : ""}
        <span class="day-meal">${meal ? escapeHtml(meal.name) : "<em>—</em>"}</span>
        <button class="small secondary" onclick="rerollDay(${i})" title="Pick another">🔄</button>
      </div>`;
  }).join("") + (message ? `<p class="notice">${escapeHtml(message)}</p>` : "");

  shopBtn.classList.remove("hidden");
}

document.getElementById("pick-week").addEventListener("click", pickWeek);
document.getElementById("week-to-shopping").addEventListener("click", weekToShopping);

// ---------- Shopping list ----------

// Same ingredient = same name, ignoring capitals, extra spaces and plural "s"
// ("Banana", "banana " and "bananas" all count as one item)
function shoppingKey(name) {
  let n = name.trim().toLowerCase().replace(/\s+/g, " ");
  if (n.length > 4 && n.endsWith("oes")) n = n.slice(0, -2);                    // tomatoes -> tomato
  else if (n.length > 3 && n.endsWith("s") && !n.endsWith("ss")) n = n.slice(0, -1); // bananas -> banana
  return n;
}

// Add to an existing line if it's the same item, otherwise make a new line
function addShoppingItem(name, amount, unit) {
  const base = toBase(amount, unit);
  const key = shoppingKey(name);
  const existing = shopping.find(s => shoppingKey(s.name) === key && s.unit === base.unit);

  if (existing) {
    existing.amount += base.amount;
    existing.done = false;
  } else {
    shopping.push({ name: name.trim(), amount: base.amount, unit: base.unit, done: false });
  }
}

function addToShopping(mealList) {
  mealList.forEach(meal => {
    meal.ingredients.forEach(ing => addShoppingItem(ing.name, ing.amount, ing.unit));
  });
  save("shopping", shopping);
  renderShopping();
}

function addMealToShopping(id, button) {
  const meal = findMeal(id);
  if (!meal) return;
  rememberEaten(meal);
  addToShopping([meal]);
  button.textContent = "✓ Added";
  setTimeout(() => { button.textContent = "🛒 Add to shopping list"; }, 1500);
}

// Add a single item from the Shopping tab
document.getElementById("shop-unit").innerHTML = UNITS.map(u => `<option value="${u}">${u}</option>`).join("");
document.getElementById("shop-unit").value = "pcs";

document.getElementById("shop-form").addEventListener("submit", event => {
  event.preventDefault();
  const nameInput = document.getElementById("shop-name");
  const amountInput = document.getElementById("shop-amount");
  const name = nameInput.value.trim();
  if (!name) return;

  const amount = parseFloat(amountInput.value);
  addShoppingItem(name, isNaN(amount) || amount <= 0 ? 1 : amount, document.getElementById("shop-unit").value);
  save("shopping", shopping);
  renderShopping();

  nameInput.value = "";
  amountInput.value = "";
  nameInput.focus();
});

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

addStarterMeals();

function renderAll() {
  renderMeals();
  renderSuggestion();
  renderWeek();
  renderShopping();
}

renderAll();
