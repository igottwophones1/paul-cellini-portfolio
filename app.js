const categoryListEl = document.getElementById("categoryList");
const detailEl = document.getElementById("detail");
const detailInnerEl = document.getElementById("detailInner");
const detailEmptyEl = document.getElementById("detailEmpty");
const homeLinkEl = document.getElementById("homeLink");

let DATA = null;

let openCategoryId = null;     // which category is expanded
let selectedProjectId = null;  // which project is selected (within open category)

function escHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseHash() {
  // #category or #category/project
  const raw = (location.hash || "").replace(/^#/, "").trim();
  if (!raw) return { categoryId: null, projectId: null };
  const [categoryId, projectId] = raw.split("/").map(decodeURIComponent);
  return { categoryId: categoryId || null, projectId: projectId || null };
}

function setHash(categoryId, projectId) {
  if (!categoryId) {
    history.pushState(null, "", "#");
    return;
  }
  const h = projectId
    ? `#${encodeURIComponent(categoryId)}/${encodeURIComponent(projectId)}`
    : `#${encodeURIComponent(categoryId)}`;
  if (location.hash !== h) history.pushState(null, "", h);
}

function findCategory(id) {
  return DATA.categories.find(c => c.id === id) ?? null;
}

function findProject(category, projectId) {
  return category.projects.find(p => p.id === projectId) ?? null;
}

function renderMedia(media) {
  if (!media) return "";

  if (media.type === "youtube" && media.id) {
    const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(media.id)}`;
    return `<div class="mediaWrap"><iframe class="mediaFrame" src="${src}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
  }

  if (media.type === "vimeo" && media.id) {
    const src = `https://player.vimeo.com/video/${encodeURIComponent(media.id)}`;
    return `<div class="mediaWrap"><iframe class="mediaFrame" src="${src}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  }

  if (media.type === "image" && media.src) {
    return `<div class="mediaWrap"><img class="mediaImg" src="${escHtml(media.src)}" alt="${escHtml(media.alt || "")}"></div>`;
  }

  return "";
}

function clearDetail() {
  detailInnerEl.innerHTML = "";
  detailEmptyEl.style.display = "block";
}

function renderDetail(categoryId, projectId) {
  if (!categoryId || !projectId) {
    clearDetail();
    return;
  }

  const cat = findCategory(categoryId);
  if (!cat) return clearDetail();

  const proj = findProject(cat, projectId);
  if (!proj) return clearDetail();

  detailEmptyEl.style.display = "none";

  const metaParts = [];
  if (proj.role) metaParts.push(escHtml(proj.role));
  if (proj.date) metaParts.push(escHtml(proj.date));

  detailInnerEl.innerHTML = `
    <article class="detailCard">
      <h1 class="detailTitle">${escHtml(proj.title)}</h1>
      ${renderMedia(proj.media)}
      ${metaParts.length ? `<p class="detailMeta">${metaParts.join(" • ")}</p>` : ""}
      ${proj.description ? `<p class="detailMeta">${proj.description}  </p>` : ""}
      </article>
  `;
  detailInnerEl.classList.remove("detailInnerEnter");
// force reflow so the animation can retrigger
  void detailInnerEl.offsetWidth;
  detailInnerEl.classList.add("detailInnerEnter");
  // Optional: if the detail pane is scrolled, bring it to top on each selection
  detailEl.scrollTo({ top: 0, behavior: "smooth" });
}

function onCategoryClick(categoryId) {
  // Changing category collapses previous selection + clears detail pane
  if (openCategoryId !== categoryId) {
    openCategoryId = categoryId;
    selectedProjectId = null;
    setHash(openCategoryId, null);
    clearDetail();
    renderNav();
    return;
  }

  // Clicking the already-open category toggles it closed
  openCategoryId = null;
  selectedProjectId = null;
  setHash(null, null);
  clearDetail();
  renderNav();
}

function onProjectClick(categoryId, projectId) {
  openCategoryId = categoryId;
  selectedProjectId = projectId;
  setHash(openCategoryId, selectedProjectId);
  renderNav();
  renderDetail(openCategoryId, selectedProjectId);
}

function renderNav() {
  categoryListEl.innerHTML = "";

  for (const cat of DATA.categories) {
    const row = document.createElement("div");
    row.className = "categoryRow";

    const catBtn = document.createElement("button");
    catBtn.className = "categoryBtn";
    catBtn.type = "button";
    catBtn.textContent = cat.title;
    const expanded = (cat.id === openCategoryId);
    catBtn.setAttribute("aria-expanded", expanded ? "true" : "false");
    catBtn.addEventListener("click", () => onCategoryClick(cat.id));

    const projectList = document.createElement("ul");
    projectList.className = "projectList";
    projectList.setAttribute("data-open", expanded ? "true" : "false");

    if (expanded) {
      for (const proj of cat.projects) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "projectLink";
        a.href = `#${encodeURIComponent(cat.id)}/${encodeURIComponent(proj.id)}`;
        a.textContent = proj.title;

        const isCurrent = (cat.id === openCategoryId && proj.id === selectedProjectId);
        if (isCurrent) a.setAttribute("aria-current", "true");

        a.addEventListener("click", (e) => {
          e.preventDefault();
          onProjectClick(cat.id, proj.id);
        });

        li.appendChild(a);
        projectList.appendChild(li);
      }
    }

    row.appendChild(catBtn);
    row.appendChild(projectList);
    categoryListEl.appendChild(row);
  }
}

async function loadData() {
  const res = await fetch("projects.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load projects.json: ${res.status}`);
  DATA = await res.json();

  homeLinkEl.textContent = DATA.siteTitle || "Portfolio";
}

function initFromHash() {
  const { categoryId, projectId } = parseHash();

  // If hash names a valid category, open it; else nothing open
  if (categoryId && findCategory(categoryId)) {
    openCategoryId = categoryId;
  } else {
    openCategoryId = null;
  }

  // Only select project if it exists in the open category
  selectedProjectId = null;
  if (openCategoryId && projectId) {
    const cat = findCategory(openCategoryId);
    if (cat && findProject(cat, projectId)) selectedProjectId = projectId;
  }

  renderNav();
  renderDetail(openCategoryId, selectedProjectId);
}

homeLinkEl.addEventListener("click", (e) => {
  e.preventDefault();
  openCategoryId = null;
  selectedProjectId = null;
  setHash(null, null);
  clearDetail();
  renderNav();
});

window.addEventListener("hashchange", () => initFromHash());

(async function main() {
  await loadData();
  initFromHash();
})();
