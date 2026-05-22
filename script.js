/* ============================================================
   Missoula High Performance — link wiring + waiver gate

   • Every clickable URL lives in /links.json.
   • Stripe "Buy" buttons are gated behind a signed waiver:
       1. User clicks Buy.
       2. If no waiver on file (localStorage), the gate modal opens.
       3. User picks Adult or Minor waiver — pending pack is saved
          to sessionStorage, then redirected to JotForm.
       4. JotForm submit redirects back to the site with
          ?waiver_signed=adult|minor in the URL.
       5. On return, we save signed state and auto-open the
          pending Stripe Payment Link in a new tab.
   ============================================================ */

(function () {
  const WAIVER_KEY = "mhp_waiver_signed";       // localStorage: "adult" | "minor"
  const PENDING_KEY = "mhp_pending_stripe";     // sessionStorage: e.g. "pt-1on1-8"
  let LINKS = {};

  // -------------------- helpers --------------------
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return document.querySelectorAll(sel); }
  function getSigned() { return localStorage.getItem(WAIVER_KEY); }
  function setSigned(kind) { localStorage.setItem(WAIVER_KEY, kind); }
  function clearSigned() { localStorage.removeItem(WAIVER_KEY); }
  function openExternal(url) {
    if (!url) return;
    window.open(url, "_blank", "noopener");
  }
  function isPlaceholder(url) { return !url || url.includes("REPLACE_ME"); }

  // -------------------- load links + wire buttons --------------------
  async function init() {
    try {
      const res = await fetch("/links.json", { cache: "no-cache" });
      LINKS = await res.json();
    } catch (e) {
      console.error("Could not load links.json", e);
    }

    $$("[data-link]").forEach(wireLink);
    handleReturnFromJotForm();
    refreshWaiverBanner();
    wireModal();
  }

  function resolveUrl(el) {
    const kind = el.getAttribute("data-link");
    if (kind === "stripe") {
      return (LINKS.stripe || {})[el.getAttribute("data-product")];
    }
    return LINKS[kind];
  }

  function wireLink(el) {
    const kind = el.getAttribute("data-link");
    const url = resolveUrl(el);

    if (isPlaceholder(url)) {
      el.classList.add("is-placeholder");
      el.setAttribute("title", "Link not yet configured — update links.json");
      el.addEventListener("click", (e) => {
        e.preventDefault();
        alert("This link isn't configured yet — edit links.json.");
      });
      return;
    }

    // Stripe Buy buttons: route through the waiver gate
    if (kind === "stripe") {
      el.setAttribute("href", url);
      el.classList.toggle("needs-waiver", !getSigned());
      el.addEventListener("click", (e) => {
        if (!getSigned()) {
          e.preventDefault();
          sessionStorage.setItem(PENDING_KEY, el.getAttribute("data-product"));
          openWaiverModal();
          return;
        }
        // Already signed — allow the link to open (in new tab)
        e.preventDefault();
        openExternal(url);
      });
      return;
    }

    // Waiver links inside the modal: same-tab redirect so JotForm can
    // redirect us back. Outside the modal (footer, get-started), open
    // in a new tab so the user doesn't lose the page.
    if (kind === "waiver-adult" || kind === "waiver-minor") {
      const inModal = !!el.closest("#waiverModal") || el.hasAttribute("data-modal-waiver");
      el.setAttribute("href", url);
      if (inModal) {
        // Same-tab navigation so JotForm's thank-you redirect returns here
        el.addEventListener("click", (e) => {
          e.preventDefault();
          window.location.href = url;
        });
      } else {
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener");
      }
      return;
    }

    // Everything else (calendly etc.): open in new tab
    el.setAttribute("href", url);
    el.setAttribute("target", "_blank");
    el.setAttribute("rel", "noopener");
  }

  // -------------------- modal --------------------
  function openWaiverModal() {
    const modal = $("#waiverModal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    // Focus first action button
    const firstBtn = modal.querySelector(".btn");
    if (firstBtn) firstBtn.focus();
  }
  function closeWaiverModal() {
    const modal = $("#waiverModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }
  function wireModal() {
    $$("[data-modal-close]").forEach((el) =>
      el.addEventListener("click", closeWaiverModal)
    );
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeWaiverModal();
    });
  }

  // -------------------- handle return from JotForm --------------------
  function handleReturnFromJotForm() {
    const params = new URLSearchParams(window.location.search);
    const signed = params.get("waiver_signed");
    if (signed !== "adult" && signed !== "minor") return;

    setSigned(signed);

    // Clean the URL (remove the query string) without reloading
    const cleanUrl = window.location.pathname + window.location.hash;
    history.replaceState({}, "", cleanUrl);

    // If there was a pending purchase, fire it now in a new tab
    const pending = sessionStorage.getItem(PENDING_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_KEY);
      const url = (LINKS.stripe || {})[pending];
      if (url && !isPlaceholder(url)) {
        // Brief delay so the banner renders first, then open Stripe
        setTimeout(() => openExternal(url), 600);
      }
    }
  }

  // -------------------- banner --------------------
  function refreshWaiverBanner() {
    const banner = $("#waiverBanner");
    const text = $("#waiverBannerText");
    if (!banner || !text) return;

    const kind = getSigned();
    if (!kind) {
      banner.classList.remove("is-visible");
      banner.setAttribute("aria-hidden", "true");
      return;
    }
    text.textContent =
      kind === "adult"
        ? "Adult waiver on file — you can purchase any pack."
        : "Minor waiver on file — you can purchase any pack.";
    banner.classList.add("is-visible");
    banner.setAttribute("aria-hidden", "false");

    // Update all Stripe buttons to remove the lock state
    $$('[data-link="stripe"]').forEach((el) => el.classList.remove("needs-waiver"));
  }

  // Banner controls (always wired; no-op when banner hidden)
  document.addEventListener("click", (e) => {
    if (e.target && e.target.id === "waiverBannerReset") {
      if (!confirm("Clear your saved waiver status? You'll need to sign again before purchase.")) return;
      clearSigned();
      refreshWaiverBanner();
      $$('[data-link="stripe"]').forEach((el) => el.classList.add("needs-waiver"));
    }
    if (e.target && e.target.id === "waiverBannerClose") {
      const b = $("#waiverBanner");
      if (b) b.classList.remove("is-visible");
    }
  });

  // -------------------- footer year + smooth scroll --------------------
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = a.getAttribute("href");
      if (target.length > 1 && document.querySelector(target)) {
        e.preventDefault();
        document.querySelector(target).scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  init();
})();
