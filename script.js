/* ============================================================
   Missoula High Performance — link wiring

   All URLs live in /links.json. Edit that file, save, refresh
   the site — no code changes needed.
   ============================================================ */

async function wireLinks() {
  let LINKS = {};
  try {
    const res = await fetch("/links.json", { cache: "no-cache" });
    LINKS = await res.json();
  } catch (e) {
    console.error("Could not load links.json — buttons will show TODO badges.", e);
  }

  document.querySelectorAll("[data-link]").forEach((el) => {
    const kind = el.getAttribute("data-link");
    let url;
    if (kind === "stripe") {
      const product = el.getAttribute("data-product");
      url = LINKS.stripe?.[product];
    } else {
      url = LINKS[kind];
    }

    if (!url || url.includes("REPLACE_ME")) {
      el.classList.add("is-placeholder");
      el.setAttribute("title", "Link not yet configured — update links.json");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        alert(
          "This link isn't configured yet.\n\n" +
          "Edit links.json — replace the REPLACE_ME value with the real URL."
        );
      });
      return;
    }
    el.setAttribute("href", url);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  });
}

wireLinks();

// Footer year
const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

// Smooth scroll for in-page anchors
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const target = a.getAttribute("href");
    if (target.length > 1 && document.querySelector(target)) {
      e.preventDefault();
      document.querySelector(target).scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
});
