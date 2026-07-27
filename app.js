const SUPPORTED_LANGUAGES = ["en", "he", "fr", "ko"];
const RTL_LANGUAGES = new Set(["he"]);
const FAVORITES_KEY = "odh-favorites";
const LANGUAGE_KEY = "odh-language";

let procedures = [];
let translations = {};
let language = localStorage.getItem(LANGUAGE_KEY) || detectLanguage();
let activeCategory = "all";
let searchTerm = "";
let deferredInstallPrompt = null;
let previousHash = "#home";

const els = {
  languageSelect: document.querySelector("#languageSelect"),
  installButton: document.querySelector("#installButton"),
  featuredGrid: document.querySelector("#featuredGrid"),
  procedureGrid: document.querySelector("#procedureGrid"),
  favoritesGrid: document.querySelector("#favoritesGrid"),
  procedureCount: document.querySelector("#procedureCount"),
  procedureSearch: document.querySelector("#procedureSearch"),
  categoryFilters: document.querySelector("#categoryFilters"),
  clearFilters: document.querySelector("#clearFilters"),
  resultsCount: document.querySelector("#resultsCount"),
  emptyState: document.querySelector("#emptyState"),
  favoritesEmpty: document.querySelector("#favoritesEmpty"),
  documentInput: document.querySelector("#documentInput"),
  fileInfo: document.querySelector("#fileInfo"),
  demoAnalysisButton: document.querySelector("#demoAnalysisButton"),
  demoResult: document.querySelector("#demoResult"),
  detail: document.querySelector("#procedureDetail"),
  backButton: document.querySelector("#backButton")
};

boot();

async function boot() {
  const response = await fetch("./data/procedures.json");
  const payload = await response.json();
  procedures = payload.procedures;
  translations = payload.ui;

  if (!SUPPORTED_LANGUAGES.includes(language)) language = "en";
  els.languageSelect.value = language;
  els.procedureCount.textContent = procedures.length;

  bindEvents();
  setLanguage(language);
  registerServiceWorker();
  route();
}

function detectLanguage() {
  const candidate = (navigator.language || "en").slice(0, 2).toLowerCase();
  return SUPPORTED_LANGUAGES.includes(candidate) ? candidate : "en";
}

function t(key) {
  return translations[language]?.[key] ?? translations.en?.[key] ?? key;
}

function setLanguage(nextLanguage) {
  language = SUPPORTED_LANGUAGES.includes(nextLanguage) ? nextLanguage : "en";
  localStorage.setItem(LANGUAGE_KEY, language);
  document.documentElement.lang = language;
  document.documentElement.dir = RTL_LANGUAGES.has(language) ? "rtl" : "ltr";
  els.languageSelect.value = language;

  document.querySelectorAll("[data-i18n]").forEach(node => {
    const key = node.dataset.i18n;
    node.textContent = t(key);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(node => {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  });

  renderCategoryFilters();
  renderFeatured();
  renderProcedures();
  renderFavorites();
  route(false);
}

function bindEvents() {
  els.languageSelect.addEventListener("change", event => setLanguage(event.target.value));
  els.procedureSearch.addEventListener("input", event => {
    searchTerm = event.target.value.trim().toLocaleLowerCase(language);
    renderProcedures();
  });
  els.clearFilters.addEventListener("click", () => {
    activeCategory = "all";
    searchTerm = "";
    els.procedureSearch.value = "";
    renderCategoryFilters();
    renderProcedures();
  });
  els.documentInput.addEventListener("change", handleFile);
  els.demoAnalysisButton.addEventListener("click", () => {
    els.demoResult.hidden = false;
    els.demoResult.scrollIntoView({behavior: "smooth", block: "start"});
  });
  els.backButton.addEventListener("click", () => {
    location.hash = previousHash.startsWith("#procedure/") ? "#procedures" : previousHash;
  });
  window.addEventListener("hashchange", () => route());
  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });
  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function renderCategoryFilters() {
  const categories = ["all", "aliyah", "identity", "health", "employment"];
  els.categoryFilters.innerHTML = "";
  categories.forEach(category => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip ${activeCategory === category ? "active" : ""}`;
    button.textContent = t(category);
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategoryFilters();
      renderProcedures();
    });
    els.categoryFilters.append(button);
  });
}

function localized(procedure) {
  return procedure.translations[language] || procedure.translations.en;
}

function searchableText(procedure) {
  const item = localized(procedure);
  return [
    item.title, item.summary, item.notes,
    ...(item.who || []), ...(item.documents || []), ...(item.steps || []),
    procedure.agency[language] || procedure.agency.en,
    t(procedure.category)
  ].join(" ").toLocaleLowerCase(language);
}

function filterProcedures() {
  return procedures.filter(procedure => {
    const categoryMatch = activeCategory === "all" || procedure.category === activeCategory;
    const searchMatch = !searchTerm || searchableText(procedure).includes(searchTerm);
    return categoryMatch && searchMatch;
  });
}

function renderFeatured() {
  els.featuredGrid.innerHTML = "";
  procedures.slice(0, 3).forEach(procedure => els.featuredGrid.append(createProcedureCard(procedure)));
}

function renderProcedures() {
  if (!procedures.length) return;
  const filtered = filterProcedures();
  els.procedureGrid.innerHTML = "";
  filtered.forEach(procedure => els.procedureGrid.append(createProcedureCard(procedure)));
  els.emptyState.hidden = filtered.length > 0;
  const countWord = filtered.length === 1 ? t("result") : t("results");
  els.resultsCount.textContent = `${filtered.length} ${countWord}`;
}

function createProcedureCard(procedure) {
  const template = document.querySelector("#procedureCardTemplate");
  const card = template.content.firstElementChild.cloneNode(true);
  const item = localized(procedure);
  const favorites = getFavorites();
  const favoriteButton = card.querySelector(".favorite-button");

  card.querySelector(".category-badge").textContent = t(procedure.category);
  card.querySelector("h3").textContent = item.title;
  card.querySelector(".card-summary").textContent = item.summary;
  card.querySelector(".agency-name").textContent = procedure.agency[language] || procedure.agency.en;
  const stepCount = item.steps?.length || 0;
  card.querySelector(".steps-count").textContent = `${stepCount} ${stepCount === 1 ? t("step") : t("steps")}`;
  card.querySelector(".card-link").href = `#procedure/${procedure.id}`;
  card.querySelector(".card-link span").textContent = t("openGuide");

  const active = favorites.includes(procedure.id);
  favoriteButton.classList.toggle("active", active);
  favoriteButton.textContent = active ? "★" : "☆";
  favoriteButton.setAttribute("aria-label", active ? "Remove saved procedure" : "Save procedure");
  favoriteButton.addEventListener("click", () => toggleFavorite(procedure.id));

  return card;
}

function getFavorites() {
  try {
    const value = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function toggleFavorite(id) {
  const favorites = getFavorites();
  const next = favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id];
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  renderFeatured();
  renderProcedures();
  renderFavorites();
}

function renderFavorites() {
  if (!procedures.length) return;
  const favorites = getFavorites();
  const saved = procedures.filter(item => favorites.includes(item.id));
  els.favoritesGrid.innerHTML = "";
  saved.forEach(procedure => els.favoritesGrid.append(createProcedureCard(procedure)));
  els.favoritesEmpty.hidden = saved.length > 0;
}

function renderDetail(procedure) {
  const item = localized(procedure);
  const agency = procedure.agency[language] || procedure.agency.en;
  const date = new Intl.DateTimeFormat(language, {dateStyle: "medium"}).format(new Date(`${procedure.updatedAt}T12:00:00`));

  els.detail.innerHTML = `
    <header class="detail-header">
      <span class="category-badge">${escapeHtml(t(procedure.category))}</span>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="detail-summary">${escapeHtml(item.summary)}</p>
      <div class="detail-meta">
        <span class="meta-pill">${escapeHtml(agency)}</span>
        <span class="meta-pill">${item.steps.length} ${escapeHtml(item.steps.length === 1 ? t("step") : t("steps"))}</span>
        <span class="meta-pill">${escapeHtml(t("lastChecked"))}: ${escapeHtml(date)}</span>
      </div>
    </header>
    <div class="detail-grid">
      <div>
        <section class="detail-section">
          <h2>${escapeHtml(t("whoIsItFor"))}</h2>
          <ul class="check-list">${item.who.map(value => `<li>✓ ${escapeHtml(value)}</li>`).join("")}</ul>
        </section>
        <section class="detail-section">
          <h2>${escapeHtml(t("documentsNeeded"))}</h2>
          <ul class="check-list">${item.documents.map(value => `<li>□ ${escapeHtml(value)}</li>`).join("")}</ul>
        </section>
        <section class="detail-section">
          <h2>${escapeHtml(t("procedureSteps"))}</h2>
          <ol class="step-list">${item.steps.map(value => `<li><span>${escapeHtml(value)}</span></li>`).join("")}</ol>
        </section>
      </div>
      <aside>
        <section class="detail-section">
          <h2>${escapeHtml(t("importantNotes"))}</h2>
          <div class="notice-box">${escapeHtml(item.notes)}</div>
        </section>
        <section class="detail-section source-card">
          <h2>${escapeHtml(t("officialReference"))}</h2>
          <p>${escapeHtml(agency)}</p>
          <a href="${escapeAttribute(procedure.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(t("openOfficial"))} ↗</a>
          <p class="updated">${escapeHtml(t("lastChecked"))}: ${escapeHtml(date)}</p>
        </section>
      </aside>
    </div>
  `;
}

function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    els.fileInfo.hidden = true;
    els.demoAnalysisButton.disabled = true;
    return;
  }
  const safeName = escapeHtml(file.name);
  const size = file.size < 1024 * 1024
    ? `${Math.ceil(file.size / 1024)} KB`
    : `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
  els.fileInfo.innerHTML = `<strong>${safeName}</strong><br><span>${escapeHtml(file.type || "file")} · ${size}</span>`;
  els.fileInfo.hidden = false;
  els.demoAnalysisButton.disabled = false;
  els.demoResult.hidden = true;
}

function route(remember = true) {
  const hash = location.hash || "#home";
  const views = {
    home: document.querySelector("#homeView"),
    procedures: document.querySelector("#proceduresView"),
    analyzer: document.querySelector("#analyzerView"),
    favorites: document.querySelector("#favoritesView"),
    detail: document.querySelector("#detailView")
  };

  Object.values(views).forEach(view => view.hidden = true);
  document.querySelectorAll("[data-nav]").forEach(link => link.classList.remove("active"));

  if (hash.startsWith("#procedure/")) {
    const id = decodeURIComponent(hash.split("/")[1] || "");
    const procedure = procedures.find(item => item.id === id);
    if (procedure) {
      views.detail.hidden = false;
      renderDetail(procedure);
    } else {
      location.hash = "#procedures";
      return;
    }
  } else {
    const key = hash.replace("#", "") || "home";
    const view = views[key] || views.home;
    view.hidden = false;
    document.querySelector(`[data-nav="${key}"]`)?.classList.add("active");
    if (key === "procedures") renderProcedures();
    if (key === "favorites") renderFavorites();
    if (remember && key !== "detail") previousHash = hash;
  }

  window.scrollTo({top: 0, behavior: "instant"});
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function escapeAttribute(value = "") {
  return escapeHtml(value);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker registration failed", error));
  }
}
