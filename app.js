const SUPPORTED_LANGUAGES = ["en", "he", "fr", "ko"];
const RTL_LANGUAGES = new Set(["he"]);
const FAVORITES_KEY = "odh-favorites";
const LANGUAGE_KEY = "odh-language";
const COMPLETED_KEY = "odh-completed";

let procedures = [];
let translations = {};
const requestedLanguage = new URLSearchParams(location.search).get("lang");
let language = SUPPORTED_LANGUAGES.includes(requestedLanguage)
  ? requestedLanguage
  : (localStorage.getItem(LANGUAGE_KEY) || detectLanguage());
let activeCategory = "all";
let searchTerm = "";
let deferredInstallPrompt = null;
let previousHash = "#home";

const els = {
  languageSelect: document.querySelector("#languageSelect"),
  installButton: document.querySelector("#installButton"),
  shareButton: document.querySelector("#shareButton"),
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
  backButton: document.querySelector("#backButton"),
  toast: document.querySelector("#toast"),
  journeyGrid: document.querySelector("#journeyGrid"),
  journeyProgressText: document.querySelector("#journeyProgressText"),
  journeyProgressBar: document.querySelector("#journeyProgressBar")
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
  const localizedUrl = new URL(location.href);
  localizedUrl.searchParams.set("lang", language);
  history.replaceState({}, "", `${localizedUrl.pathname}?${localizedUrl.searchParams.toString()}${location.hash}`);
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
  renderJourney();
  route(false);
}

function bindEvents() {
  els.languageSelect.addEventListener("change", event => setLanguage(event.target.value));
  els.shareButton.addEventListener("click", () => shareCurrentPage());
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
  const categories = ["all", "aliyah", "identity", "health", "family", "employment", "tax", "transport", "education"];
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
    item.title, item.summary, item.notes, item.timing, item.cost, item.channel, item.after,
    ...(item.who || []), ...(item.documents || []), ...(item.steps || []), ...(item.mistakes || []),
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
  card.querySelector(".steps-count").textContent = `${t(procedure.stage || "whenNeeded")} · ${stepCount} ${stepCount === 1 ? t("step") : t("steps")}`;
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

function getCompleted() {
  try {
    const value = JSON.parse(localStorage.getItem(COMPLETED_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function isCompleted(id) {
  return getCompleted().includes(id);
}

function toggleComplete(id) {
  const completed = getCompleted();
  const next = completed.includes(id)
    ? completed.filter(item => item !== id)
    : [...completed, id];
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
  renderJourney();
  const currentId = location.hash.startsWith("#procedure/") ? decodeURIComponent(location.hash.split("/")[1] || "") : "";
  if (currentId === id) {
    const procedure = procedures.find(item => item.id === id);
    if (procedure) renderDetail(procedure);
  }
}

function renderJourney() {
  if (!els.journeyGrid || !procedures.length) return;
  const journeyProcedures = procedures.filter(item => item.stage === "firstDays" || item.stage === "firstMonth");
  const completed = getCompleted();
  els.journeyGrid.innerHTML = "";

  journeyProcedures.forEach(procedure => {
    const item = localized(procedure);
    const done = completed.includes(procedure.id);
    const card = document.createElement("article");
    card.className = `journey-card ${done ? "completed" : ""}`;
    card.innerHTML = `
      <button class="journey-check" type="button" aria-label="${escapeAttribute(done ? t("markNotDone") : t("markDone"))}">
        ${done ? "✓" : ""}
      </button>
      <div class="journey-content">
        <div class="journey-topline">
          <span class="category-badge">${escapeHtml(t(procedure.stage))}</span>
          <span class="priority-label">${escapeHtml(t(procedure.priority === "high" ? "priorityHigh" : "priorityMedium"))}</span>
        </div>
        <h3><a href="#procedure/${escapeAttribute(procedure.id)}">${escapeHtml(item.title)}</a></h3>
        <p>${escapeHtml(item.summary)}</p>
      </div>`;
    card.querySelector(".journey-check").addEventListener("click", () => toggleComplete(procedure.id));
    els.journeyGrid.append(card);
  });

  const doneCount = journeyProcedures.filter(item => completed.includes(item.id)).length;
  els.journeyProgressText.textContent = `${doneCount} / ${journeyProcedures.length} ${t("completed")}`;
  els.journeyProgressBar.style.width = journeyProcedures.length ? `${Math.round(doneCount / journeyProcedures.length * 100)}%` : "0%";
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
  const done = isCompleted(procedure.id);

  els.detail.innerHTML = `
    <header class="detail-header">
      <div class="detail-labels">
        <span class="category-badge">${escapeHtml(t(procedure.category))}</span>
        <span class="stage-badge">${escapeHtml(t(procedure.stage || "whenNeeded"))}</span>
      </div>
      <h1>${escapeHtml(item.title)}</h1>
      <p class="detail-summary">${escapeHtml(item.summary)}</p>
      <div class="detail-meta">
        <span class="meta-pill">${escapeHtml(agency)}</span>
        <span class="meta-pill">${item.steps.length} ${escapeHtml(item.steps.length === 1 ? t("step") : t("steps"))}</span>
        <span class="meta-pill">${escapeHtml(t("lastChecked"))}: ${escapeHtml(date)}</span>
      </div>
      <div class="quick-facts">
        <div><span>${escapeHtml(t("timing"))}</span><strong>${escapeHtml(item.timing || "")}</strong></div>
        <div><span>${escapeHtml(t("cost"))}</span><strong>${escapeHtml(item.cost || "")}</strong></div>
        <div><span>${escapeHtml(t("channel"))}</span><strong>${escapeHtml(item.channel || "")}</strong></div>
      </div>
      <div class="detail-actions" aria-label="Guide actions">
        <button id="completeGuideButton" class="button ${done ? "button-complete" : "button-primary"}" type="button">${escapeHtml(done ? t("markNotDone") : t("markDone"))}</button>
        <button id="printGuideButton" class="button button-secondary" type="button">${escapeHtml(t("printGuide"))}</button>
        <button id="copyChecklistButton" class="button button-secondary" type="button">${escapeHtml(t("copyChecklist"))}</button>
        <button id="shareGuideButton" class="button button-ghost" type="button">${escapeHtml(t("shareGuide"))}</button>
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
        ${item.mistakes?.length ? `
        <section class="detail-section">
          <h2>${escapeHtml(t("commonMistakes"))}</h2>
          <ul class="warning-list">${item.mistakes.map(value => `<li>${escapeHtml(value)}</li>`).join("")}</ul>
        </section>` : ""}
        ${item.after ? `
        <section class="detail-section">
          <h2>${escapeHtml(t("afterCompletion"))}</h2>
          <div class="after-box">${escapeHtml(item.after)}</div>
        </section>` : ""}
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
        <div class="document-tip">${escapeHtml(t("documentTip"))}</div>
      </aside>
    </div>
  `;

  document.querySelector("#completeGuideButton")?.addEventListener("click", () => toggleComplete(procedure.id));
  document.querySelector("#printGuideButton")?.addEventListener("click", () => window.print());
  document.querySelector("#copyChecklistButton")?.addEventListener("click", () => copyChecklist(procedure));
  document.querySelector("#shareGuideButton")?.addEventListener("click", () => shareCurrentPage(procedure));
}

async function copyChecklist(procedure) {
  const item = localized(procedure);
  const agency = procedure.agency[language] || procedure.agency.en;
  const text = [
    item.title,
    `${t("authority")}: ${agency}`,
    "",
    `${t("timing")}: ${item.timing || ""}`,
    `${t("cost")}: ${item.cost || ""}`,
    `${t("channel")}: ${item.channel || ""}`,
    "",
    t("documentsNeeded"),
    ...item.documents.map(value => `□ ${value}`),
    "",
    t("procedureSteps"),
    ...item.steps.map((value, index) => `${index + 1}. ${value}`),
    "",
    t("commonMistakes"),
    ...(item.mistakes || []).map(value => `• ${value}`),
    "",
    `${t("afterCompletion")}: ${item.after || ""}`,
    "",
    `${t("officialReference")}: ${procedure.source}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast(t("checklistCopied"));
  } catch {
    showToast(t("copyFailed"));
  }
}

async function shareCurrentPage(procedure = null) {
  const url = new URL(location.href);
  url.searchParams.set("lang", language);
  if (procedure) url.hash = `procedure/${procedure.id}`;

  const item = procedure ? localized(procedure) : null;
  const shareData = {
    title: item?.title || "Oleh Document Helper",
    text: item?.summary || t("shareDescription"),
    url: url.toString()
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await navigator.clipboard.writeText(shareData.url);
    showToast(t("linkCopied"));
  } catch {
    showToast(t("copyFailed"));
  }
}

let toastTimer;
function showToast(message) {
  if (!els.toast) return;
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2600);
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
