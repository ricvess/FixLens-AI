/*
  FIXLENS AI · FRONTEND APPLICATION
  Before running:
  1. Add your Supabase project URL and anon key below (or use environment variables via a build tool).
  2. Create the database table and Storage bucket described in the setup guide.
  3. Deploy the "diagnose" Supabase Edge Function.

  SECURITY NOTE:
  The key below is a PUBLISHABLE (public) key and is safe to ship in client-side code.
  It is NOT what protects your data: Row Level Security (RLS) policies on every table and
  Storage bucket are. See SECURITY.md / supabase-security.sql. NEVER put a service_role or
  sb_secret_ key in this file.
*/

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.81.1/+esm";

/* =========================================================
   1. SUPABASE CONFIGURATION
   ========================================================= */
// ⚠️ Replace these values with your own project credentials.
// If you use a build tool (Vite etc.) you can do:
//   const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
//   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const SUPABASE_URL      = "https://uytbxmdifvooxwqewkqw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_elN133FxSOsTRU7clR53lQ_GJBI_x0h";

const STORAGE_BUCKET      = "diagnosis-images";
const MAX_IMAGE_SIZE      = 8 * 1024 * 1024;         // 8 MB
const ALLOWED_TYPES       = ["image/jpeg", "image/png", "image/webp"];
const SIGNED_URL_TTL      = 60 * 60;                 // seconds
const MAX_IMAGE_DIMENSION = 1600;                    // px, longest side sent to AI
const JPEG_QUALITY        = 0.85;
const REQUEST_TIMEOUT     = 60 * 1000;               // ms
const FILE_EXTENSIONS     = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const SEARCH_DEBOUNCE_MS  = 250;                     // MOD 5: debounce search input

// Must be read BEFORE the Supabase client starts: the client removes the auth tokens from the URL.
const openedFromRecoveryLink = /(^|[#&?])type=recovery(&|$)/.test(window.location.hash + window.location.search);

// Where Supabase email links (confirm / reset password) should send the user back to.
// origin + pathname keeps working when the site lives in a sub-folder (e.g. GitHub Pages /repo/).
const AUTH_REDIRECT_URL = window.location.origin + window.location.pathname;

const MIN_PASSWORD_LENGTH = 8;
const MAX_CHAT_LENGTH     = 500;       // characters per follow-up question
const MAX_CHAT_HISTORY    = 10;        // messages sent back to the AI
const CHAT_TIMEOUT        = 30 * 1000; // ms

const supabaseConfigured =
  SUPABASE_URL.startsWith("https://") &&
  !SUPABASE_URL.includes("YOUR_SUPABASE") &&
  SUPABASE_ANON_KEY.length > 20 &&
  !SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

const supabase = supabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    })
  : null;

/* =========================================================
   1.5 I18N / DUAL LANGUAGE SYSTEM (ID 🇮🇩 / EN 🇬🇧)
   ========================================================= */
const translations = {
  id: {
    // Nav
    nav_how_it_works: "Cara Kerja",
    nav_categories: "Kategori",
    nav_about: "Tentang",
    nav_login: "Masuk",
    nav_get_started: "Mulai Sekarang",
    
    // Landing
    hero_eyebrow: "ASISTEN RUMAH TANGGA SEHARI-HARI",
    hero_h1: "Ada barang rusak?<br /><span>Yuk cari solusinya bersama.</span>",
    hero_desc: "Ambil foto barang yang bermasalah, pahami apa penyebabnya, dan temukan langkah perbaikan praktis dengan FixLens AI.",
    hero_btn_scan: "Mulai dengan foto",
    hero_btn_how: "Lihat cara kerja",
    hero_proof: "Panduan praktis. Keselamatan nomor satu.",
    
    // How it works
    how_eyebrow: "PROSES SEDERHANA",
    how_title: "Dari foto hingga<br /><span>langkah perbaikan yang jelas.</span>",
    step1_title: "Ambil Foto",
    step1_desc: "Unggah foto yang jelas dari barang atau area yang ingin diperiksa.",
    step2_title: "AI Memeriksa",
    step2_desc: "AI menganalisis detail visual dan mengidentifikasi potensi kerusakan.",
    step3_title: "Panduan Solusi",
    step3_desc: "Pelajari penyebab, tes keamanan, dan rekomendasi langkah perbaikan.",

    // Dashboard navigation
    nav_overview: "Ringkasan",
    nav_scanner: "AI Scanner",
    nav_history: "Riwayat Scan",
    nav_safety: "Panduan Keselamatan",
    nav_about_dashboard: "Tentang FixLens AI",
    
    // Scanner
    scanner_step1: "LANGKAH 01",
    scanner_h1: "Mari kita periksa lebih dekat.",
    scanner_sub: "Unggah foto barang atau area rumah yang ingin Anda cek.",
    scanner_cat_label: "Apa yang sedang Anda periksa? (opsional)",
    scan_take_photo: "Ambil foto",
    scan_take_photo_sub: "Gunakan kamera langsung",
    scan_upload_file: "Pilih dari file",
    scan_upload_file_sub: "Buka galeri / perangkat",
    scan_drag_hint: "atau seret dan lepas gambar Anda di sini",
    scan_privacy: "Foto Anda digunakan secara aman untuk membuat diagnosis.",
    scan_btn_analyze: "Analisis Gambar",
    
    // Chat follow-up
    chat_title: "Tanya FixLens AI",
    chat_sub: "Punya pertanyaan seputar perbaikan ini? Tanyakan apa saja atau pilih opsi di bawah.",
    chat_pill_cost: "💰 Estimasi Biaya",
    chat_pill_tools: "🔧 Alat & Bahan",
    chat_pill_safety: "⚠️ Aman Dikerjakan Sendiri?",
    chat_welcome: "Halo! Saya siap bantu jelaskan lebih detail cara memperbaiki barang ini. Mau tanya apa?",
    chat_placeholder: "Tanyakan apa saja seputar perbaikan ini...",

    // General
    btn_new_scan: "Scan Baru",
    btn_export: "Ekspor Riwayat"
  },
  en: {
    // Nav
    nav_how_it_works: "How it works",
    nav_categories: "Categories",
    nav_about: "About",
    nav_login: "Log in",
    nav_get_started: "Get started",
    
    // Landing
    hero_eyebrow: "YOUR EVERYDAY HOME ASSISTANT",
    hero_h1: "Something broken?<br /><span>Let's figure it out.</span>",
    hero_desc: "Take a photo, understand what might be wrong, and discover the next steps with FixLens AI.",
    hero_btn_scan: "Start with a photo",
    hero_btn_how: "See how it works",
    hero_proof: "Practical guidance. Safety comes first.",
    
    // How it works
    how_eyebrow: "A SIMPLE PROCESS",
    how_title: "From a photo to a<br /><span>clearer next step.</span>",
    step1_title: "Take a photo",
    step1_desc: "Upload a clear photo of the item or area you want to check.",
    step2_title: "Let AI examine it",
    step2_desc: "AI reviews visible details and looks for possible issues.",
    step3_title: "Review your guide",
    step3_desc: "Explore possible causes, safe checks, and recommended next steps.",

    // Dashboard navigation
    nav_overview: "Overview",
    nav_scanner: "AI Scanner",
    nav_history: "Scan history",
    nav_safety: "Safety guidelines",
    nav_about_dashboard: "About FixLens AI",
    
    // Scanner
    scanner_step1: "STEP 01",
    scanner_h1: "Let's take a closer look.",
    scanner_sub: "Upload a photo of the household item or area you want to check.",
    scanner_cat_label: "What are you checking? (optional)",
    scan_take_photo: "Take a photo",
    scan_take_photo_sub: "Use camera directly",
    scan_upload_file: "Upload from file",
    scan_upload_file_sub: "Browse gallery / device",
    scan_drag_hint: "or drag and drop your image anywhere here",
    scan_privacy: "Your image is used to generate your diagnosis.",
    scan_btn_analyze: "Analyze image",
    
    // Chat follow-up
    chat_title: "Ask FixLens AI",
    chat_sub: "Have questions about this repair? Ask anything or tap a quick question below.",
    chat_pill_cost: "💰 Estimated Cost",
    chat_pill_tools: "🔧 Tools Needed",
    chat_pill_safety: "⚠️ Safe to DIY?",
    chat_welcome: "Hi! I'm ready to help you repair this item. What would you like to know?",
    chat_placeholder: "Ask a follow-up question...",

    // General
    btn_new_scan: "New Scan",
    btn_export: "Export History"
  }
};

let currentLang = localStorage.getItem("fixlens-lang") || "id"; // default Bahasa Indonesia

function setLanguage(lang) {
  currentLang = lang === "en" ? "en" : "id";
  try {
    localStorage.setItem("fixlens-lang", currentLang);
  } catch (e) {}

  document.documentElement.lang = currentLang;

  // Update button badges
  const flagText = currentLang === "id" ? "🇮🇩" : "🇬🇧";
  const codeText = currentLang.toUpperCase();
  $$(".lang-toggle-btn").forEach(btn => {
    const flagEl = btn.querySelector(".lang-flag");
    const textEl = btn.querySelector(".lang-text");
    if (flagEl) flagEl.textContent = flagText;
    if (textEl) textEl.textContent = codeText;
  });

  applyTranslations();
  refreshIcons();
}

function applyTranslations() {
  const t = translations[currentLang];
  if (!t) return;

  // Landing Hero & Nav
  const navLogin = document.querySelector('[data-i18n="nav_login"]');
  if (navLogin) navLogin.textContent = t.nav_login;

  const heroH1 = document.querySelector(".hero-copy h1");
  if (heroH1) heroH1.innerHTML = t.hero_h1;

  const heroDesc = document.querySelector(".hero-description");
  if (heroDesc) heroDesc.textContent = t.hero_desc;

  const heroEyebrow = document.querySelector(".hero-copy .eyebrow");
  if (heroEyebrow) heroEyebrow.innerHTML = `<span class="eyebrow-dot"></span> ${t.hero_eyebrow}`;

  // Scanner dual button texts
  const camTitle = document.querySelector("#open-camera-btn .action-card-text strong");
  const camSub = document.querySelector("#open-camera-btn .action-card-text span");
  if (camTitle) camTitle.textContent = t.scan_take_photo;
  if (camSub) camSub.textContent = t.scan_take_photo_sub;

  const fileTitle = document.querySelector("#browse-image .action-card-text strong");
  const fileSub = document.querySelector("#browse-image .action-card-text span");
  if (fileTitle) fileTitle.textContent = t.scan_upload_file;
  if (fileSub) fileSub.textContent = t.scan_upload_file_sub;

  const dragHint = document.querySelector(".drag-drop-hint span");
  if (dragHint) dragHint.textContent = t.scan_drag_hint;

  const analyzeBtn = document.querySelector("#analyze-button");
  if (analyzeBtn) analyzeBtn.innerHTML = `${t.scan_btn_analyze} <i data-lucide="arrow-right"></i>`;

  // Sidebar links
  const sideOverview = document.querySelector('.side-link[data-dashboard-view="overview"] span');
  if (sideOverview) sideOverview.textContent = t.nav_overview;
  const sideScanner = document.querySelector('.side-link[data-dashboard-view="scanner"] span');
  if (sideScanner) sideScanner.textContent = t.nav_scanner;
  const sideHistory = document.querySelector('.side-link[data-dashboard-view="history"] span');
  if (sideHistory) sideHistory.textContent = t.nav_history;
  const sideSafety = document.querySelector('.side-link[data-dashboard-view="safety"] span');
  if (sideSafety) sideSafety.textContent = t.nav_safety;
  const sideAbout = document.querySelector('.side-link[data-dashboard-view="about"] span');
  if (sideAbout) sideAbout.textContent = t.nav_about_dashboard;
}

/* =========================================================
   2. DOM HELPERS AND APP STATE
   ========================================================= */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const state = {
  user: null,
  session: null,
  authMode: "login",
  selectedFile: null,
  previewUrl: null,
  diagnoses: [],
  currentDiagnosis: null,
  currentView: "overview",
  historyQuery: "",
  historyUrgency: "all",
  historySavedOnly: false,
  historySort: "newest",
  totalCount: 0,
  selectedCategory: null,
  savedIds: new Set()
};

const page = {
  topbar:            $("#landing-topbar"),
  landing:           $("#landing-page"),
  auth:              $("#auth-page"),
  dashboard:         $("#dashboard"),
  footer:            $("#landing-footer"),
  authForm:          $("#auth-form"),
  authMessage:       $("#auth-message"),
  authTitle:         $("#auth-title"),
  authSubtitle:      $("#auth-subtitle"),
  authSubmit:        $("#auth-submit"),
  authSwitch:        $("#auth-switch"),
  authForgot:        $("#auth-forgot"),
  nameField:         $("#name-field"),
  authName:          $("#auth-name"),
  authEmail:         $("#auth-email"),
  authPassword:      $("#auth-password"),
  uploadZone:        $("#upload-zone"),
  imageInput:        $("#image-input"),
  uploadPlaceholder: $("#upload-placeholder"),
  imagePreview:      $("#image-preview"),
  previewImage:      $("#preview-image"),
  previewFilename:   $("#preview-filename"),
  analyzeButton:     $("#analyze-button"),
  scanProgress:      $("#scan-progress"),
  progressTitle:     $("#progress-title"),
  progressSubtitle:  $("#progress-subtitle"),
  scannerError:      $("#scanner-error"),
  diagnosisSection:  $("#diagnosis-section"),
  diagnosisResult:   $("#diagnosis-result"),
  historyList:       $("#history-list"),
  recentList:        $("#recent-list"),
  toastRegion:       $("#toast-region"),
  sidebar:           $("#sidebar"),
  sidebarBackdrop:   $("#sidebar-backdrop"),
  menuButton:        $("#mobile-menu-button"),
  offlineBanner:     $("#offline-banner"),
  confirmModal:      $("#confirm-modal"),
  forgotModal:       $("#forgot-modal"),
  cameraModal:       $("#camera-modal"),
  cameraStream:      $("#camera-stream"),
  cameraSwitchBtn:   $("#camera-switch-btn"),
  cameraShutterBtn:  $("#camera-shutter-btn"),
  cameraCancelBtn:   $("#camera-cancel-btn"),
  cameraCloseBtn:    $("#camera-modal-close"),
  cameraErrorMsg:    $("#camera-error-msg")
};

/* =========================================================
   OFFLINE DETECTION (ADD 9)
   ========================================================= */
function syncOfflineBanner() {
  page.offlineBanner.classList.toggle("hidden", navigator.onLine);
}
window.addEventListener("online",  syncOfflineBanner);
window.addEventListener("offline", syncOfflineBanner);

/* =========================================================
   SCROLL REVEAL (landing page)
   ========================================================= */
function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const targets = $$(".trust-strip, .section-heading, .step-card, .category-card, .about-visual, .about-copy, .final-cta");

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const element = entry.target;
      element.classList.add("in-view");
      observer.unobserve(element);
      window.setTimeout(() => {
        element.classList.remove("reveal", "in-view");
        element.style.removeProperty("--reveal-delay");
      }, 1000);
    });
  }, { threshold: 0.12 });

  targets.forEach((element, index) => {
    element.classList.add("reveal");
    element.style.setProperty("--reveal-delay", `${(index % 4) * 80}ms`);
    observer.observe(element);
  });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function getSignedUrl(path, seconds = SIGNED_URL_TTL) {
  if (!supabase || !path) return null;
  try {
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, seconds);
    return error ? null : data?.signedUrl || null;
  } catch (error) {
    console.error("Could not create signed URL:", error);
    return null;
  }
}

async function removeStoredImage(path) {
  if (!supabase || !path) return;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.warn("Could not remove stored image:", error);
}

// Whole number 0-100, or null. Values between 0 and 1 are treated as fractions (0.87 → 87).
function normalizeConfidence(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number.parseFloat(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.min(100, Math.round(number <= 1 ? number * 100 : number));
}

function syncCategoryPicker() {
  $$("[data-pick-category]").forEach(button => {
    const active = button.dataset.pickCategory === state.selectedCategory;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setSelectedCategory(name) {
  state.selectedCategory = name || null;
  syncCategoryPicker();
}

function resetHistoryFilters() {
  state.historyQuery    = "";
  state.historyUrgency  = "all";
  state.historySavedOnly = false;
  state.historySort     = "newest";
  // MOD 4 fix: reset both state and DOM elements explicitly
  const searchEl = $("#history-search");
  if (searchEl) searchEl.value = "";
  const sortEl = $("#history-sort");
  if (sortEl) sortEl.value = "newest";   // ← BUG 4 fix: explicitly reset <select>
  renderHistory();
}

/* =========================================================
   TOAST NOTIFICATIONS (ADD 5: closeable toasts)
   ========================================================= */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `
    <i data-lucide="${type === "error" ? "alert-circle" : "check-circle-2"}"></i>
    <span>${escapeHTML(message)}</span>
    <button class="toast-close" type="button" aria-label="Close notification"><i data-lucide="x"></i></button>`;
  page.toastRegion.appendChild(toast);
  refreshIcons();

  // ADD 5: close button
  toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());

  const timer = window.setTimeout(() => toast.remove(), 4000);
  toast.querySelector(".toast-close").addEventListener("click", () => window.clearTimeout(timer));
}

/* =========================================================
   THEME
   ========================================================= */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("fixlens-theme", theme); } catch { /* storage blocked: theme still applies */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111a18" : "#f7f8f5");
  $$(".theme-toggle").forEach(button => {
    button.innerHTML = `<i data-lucide="${theme === "dark" ? "sun" : "moon"}"></i>`;
    button.setAttribute("aria-label", theme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  });
  refreshIcons();
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem("fixlens-theme"); } catch { /* ignore blocked storage */ }
  // DEV 6: auto-detect system preference if no saved preference
  if (!saved) {
    saved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  setTheme(saved === "dark" ? "dark" : "light");
}

/* =========================================================
   PAGE ROUTING
   ========================================================= */
function showPage(name, { scroll = true } = {}) {
  document.documentElement.classList.remove("restoring-session");
  page.topbar.classList.toggle("hidden", name === "dashboard");
  page.landing.classList.toggle("hidden", name !== "landing");
  page.auth.classList.toggle("hidden", name !== "auth");
  page.dashboard.classList.toggle("hidden", name !== "dashboard");
  page.footer.classList.toggle("hidden", name !== "landing");
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

function showAuth(mode = "login") {
  state.authMode = mode;
  updateAuthMode();
  showPage("auth");
  page.authEmail.focus();
}

function updateAuthMode() {
  const isSignup = state.authMode === "signup";
  page.authTitle.textContent    = isSignup ? "Create your account." : "Welcome back.";
  page.authSubtitle.textContent = isSignup
    ? "Set up your account to start using FixLens AI."
    : "Sign in to continue to your workspace.";
  page.nameField.classList.toggle("hidden", !isSignup);
  page.authName.required        = isSignup;
  page.authPassword.autocomplete = isSignup ? "new-password" : "current-password";
  page.authSubmit.innerHTML     = isSignup
    ? 'Create account <i data-lucide="arrow-right"></i>'
    : 'Log in <i data-lucide="arrow-right"></i>';
  page.authSwitch.innerHTML     = isSignup
    ? 'Already have an account? <button type="button" data-switch-auth="login">Log in</button>'
    : 'New to FixLens AI? <button type="button" data-switch-auth="signup">Create an account</button>';
  // ADD 7 / BUG 7: show forgot password only on login mode
  page.authForgot.classList.toggle("hidden", isSignup);
  hideAuthMessage();
  refreshIcons();
}

function showAuthMessage(message, type = "error") {
  page.authMessage.textContent = message;
  page.authMessage.classList.remove("hidden", "success");
  if (type === "success") page.authMessage.classList.add("success");
}
function hideAuthMessage() {
  page.authMessage.classList.add("hidden");
  page.authMessage.textContent = "";
  page.authMessage.classList.remove("success");
}

function setAuthLoading(loading) {
  page.authSubmit.disabled = loading;
  page.authSubmit.innerHTML = loading
    ? '<span class="button-spinner"></span> Please wait...'
    : state.authMode === "signup"
      ? 'Create account <i data-lucide="arrow-right"></i>'
      : 'Log in <i data-lucide="arrow-right"></i>';
  refreshIcons();
}

function getDisplayName(user) {
  return user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "there";
}

function updateUserUI(user) {
  const name    = getDisplayName(user);
  const initial = name.trim().charAt(0).toUpperCase() || "U";
  $("#sidebar-user-name").textContent  = name;
  $("#sidebar-user-email").textContent = user?.email || "";
  $("#sidebar-avatar").textContent     = initial;
  $("#top-avatar").textContent         = initial;
  $("#welcome-name").textContent       = name.split(/\s+/)[0];
  $("#current-date").textContent       = new Intl.DateTimeFormat("en", {
    weekday: "short", month: "short", day: "numeric"
  }).format(new Date());
}

/* =========================================================
   3. AUTHENTICATION
   ========================================================= */
async function handleAuthSubmit(event) {
  event.preventDefault();
  hideAuthMessage();

  if (!supabase) {
    showAuthMessage("Supabase is not configured yet. Add your project URL and anon key in script.js.");
    return;
  }

  const email    = page.authEmail.value.trim();
  const password = page.authPassword.value;
  const fullName = page.authName.value.trim();

  // MOD 2: enhanced validation
  if (!email || !password) {
    showAuthMessage("Please enter your email address and password.");
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthMessage("Please enter a valid email address.");
    return;
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    showAuthMessage(`Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
    return;
  }
  if (state.authMode === "signup") {
    if (fullName.trim().length < 2) {
      showAuthMessage("Please enter your full name (at least 2 characters).");
      return;
    }
    if (fullName.trim().length > 100) {
      showAuthMessage("Name is too long. Please use fewer than 100 characters.");
      return;
    }
  }

  setAuthLoading(true);
  try {
    if (state.authMode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: AUTH_REDIRECT_URL }
      });
      if (error) throw error;

      // With email confirmation on, Supabase hides duplicates behind an empty identities list.
      if (data.user && data.user.identities?.length === 0) {
        throw new Error("This email already has an account. Try logging in.");
      }

      if (!data.session) {
        // ADD 2: clear confirmation message
        showAuthMessage(
          "✅ Account created! Check your inbox and confirm your email, then come back to log in.",
          "success"
        );
        page.authForm.reset();
      } else {
        state.session = data.session;
        state.user    = data.user;
        await enterDashboard();
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      state.user    = data.user;
      await enterDashboard();
    }
  } catch (error) {
    showAuthMessage(authErrorMessage(error));
  } finally {
    setAuthLoading(false);
  }
}

function authErrorMessage(error) {
  const message = error?.message || "Something went wrong. Please try again.";
  if (/invalid login credentials/i.test(message))    return "Email or password is incorrect.";
  if (/already registered/i.test(message))           return "This email already has an account. Try logging in.";
  if (/password should be at least/i.test(message))  return `Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (/email not confirmed/i.test(message))          return "Please confirm your email address before logging in.";
  if (/rate limit/i.test(message))                   return "Too many attempts. Please wait a moment and try again.";
  return message;
}

async function enterDashboard() {
  if (!state.user) return;
  updateUserUI(state.user);
  showPage("dashboard");
  setDashboardView("overview");
  await loadDiagnoses();
}

function resetUserState() {
  state.user            = null;
  state.session         = null;
  state.diagnoses       = [];
  state.currentDiagnosis = null;
  state.totalCount      = 0;
  state.savedIds.clear();
  setSelectedCategory(null);
  page.diagnosisSection.classList.add("hidden");
  page.diagnosisResult.innerHTML = "";
  resetHistoryFilters();
  updateDashboardStats();
  renderHistory();
  renderRecentScans();
}

async function logout() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Offline / expired session: still clear the local session so the user is really logged out.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }
  resetUserState();
  clearSelectedImage();
  showPage("landing");
  showToast("You have been logged out.");
}

/* =========================================================
   ADD 1 / BUG 7: FORGOT PASSWORD FLOW
   ========================================================= */
function openForgotModal() {
  const emailInput = $("#forgot-email");
  if (emailInput) emailInput.value = page.authEmail.value.trim();
  const msgEl = $("#forgot-message");
  if (msgEl) { msgEl.classList.add("hidden"); msgEl.textContent = ""; }
  page.forgotModal.classList.remove("hidden");
  setTimeout(() => emailInput?.focus(), 50);
  refreshIcons();
}

function closeForgotModal() {
  page.forgotModal.classList.add("hidden");
}

/* =========================================================
   SET NEW PASSWORD (opened from the password-reset email link)
   ========================================================= */
function openRecoveryModal() {
  const modal = $("#recovery-modal");
  if (!modal) return;
  modal.classList.remove("hidden");
  setTimeout(() => $("#recovery-password")?.focus(), 50);
  refreshIcons();
}

async function handleRecoverySubmit(event) {
  event.preventDefault();
  const input  = $("#recovery-password");
  const msgEl  = $("#recovery-message");
  const submit = $("#recovery-submit");
  const show = (text, ok = false) => {
    msgEl.textContent = text;
    msgEl.classList.remove("hidden");
    msgEl.classList.toggle("success", ok);
  };

  if (!input.value || input.value.length < MIN_PASSWORD_LENGTH) {
    show(`Your password must contain at least ${MIN_PASSWORD_LENGTH} characters.`);
    return;
  }
  submit.disabled = true;
  try {
    const { error } = await supabase.auth.updateUser({ password: input.value });
    if (error) throw error;
    input.value = "";
    $("#recovery-modal").classList.add("hidden");
    showToast("Your password has been updated.");
    if (state.user) await enterDashboard();
  } catch (error) {
    show(authErrorMessage(error));
  } finally {
    submit.disabled = false;
  }
}

async function handleForgotSubmit(event) {
  event.preventDefault();
  const emailInput = $("#forgot-email");
  const msgEl      = $("#forgot-message");
  const submitBtn  = $("#forgot-submit");
  const email      = emailInput?.value.trim() || "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    if (msgEl) { msgEl.textContent = "Please enter a valid email address."; msgEl.classList.remove("hidden", "success"); }
    return;
  }

  if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<span class="button-spinner"></span> Sending...'; }

  try {
    if (!supabase) throw new Error("Supabase is not configured yet.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT_URL
    });
    if (error) throw error;
    if (msgEl) {
      msgEl.textContent = "✅ Password reset email sent! Check your inbox.";
      msgEl.classList.remove("hidden");
      msgEl.classList.add("success");
    }
    setTimeout(() => closeForgotModal(), 3000);
  } catch (err) {
    if (msgEl) { msgEl.textContent = err.message || "Could not send reset email. Try again."; msgEl.classList.remove("hidden", "success"); }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Send reset link <i data-lucide="arrow-right"></i>';
      refreshIcons();
    }
  }
}

/* =========================================================
   BUG 6 / MOD 4: CUSTOM CONFIRM MODAL
   ========================================================= */
let _confirmResolve = null;

function showConfirmModal(title, body) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    const titleEl = $("#confirm-modal-title");
    const bodyEl  = $("#confirm-modal-body");
    if (titleEl) titleEl.textContent = title;
    if (bodyEl)  bodyEl.textContent  = body;
    page.confirmModal.classList.remove("hidden");
    setTimeout(() => $("#confirm-modal-ok")?.focus(), 50);
    refreshIcons();
  });
}

function closeConfirmModal(result) {
  page.confirmModal.classList.add("hidden");
  if (_confirmResolve) { _confirmResolve(result); _confirmResolve = null; }
}

/* =========================================================
   CAMERA CONTROLLER (FITUR 1)
   ========================================================= */
let currentCameraStream = null;
let currentFacingMode = "environment"; // default kamera belakang untuk inspeksi

async function startCamera() {
  stopCamera();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError("Your browser or device does not support camera capture.");
    return;
  }

  page.cameraErrorMsg.classList.add("hidden");
  try {
    const constraints = {
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };

    currentCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    page.cameraStream.srcObject = currentCameraStream;
    await page.cameraStream.play();
  } catch (err) {
    console.error("Camera access error:", err);
    let msg = "Could not access camera. Please allow camera permissions.";
    if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
      msg = "Camera permission was denied. Please allow camera access in your browser settings.";
    } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
      msg = "No camera detected on this device.";
    }
    showCameraError(msg);
  }
}

function stopCamera() {
  if (currentCameraStream) {
    currentCameraStream.getTracks().forEach(track => track.stop());
    currentCameraStream = null;
  }
  if (page.cameraStream) {
    page.cameraStream.srcObject = null;
  }
}

function showCameraError(msg) {
  page.cameraErrorMsg.textContent = msg;
  page.cameraErrorMsg.classList.remove("hidden");
}

function openCameraModal() {
  page.cameraModal.classList.remove("hidden");
  startCamera();
  refreshIcons();
}

function closeCameraModal() {
  stopCamera();
  page.cameraModal.classList.add("hidden");
}

function switchCamera() {
  currentFacingMode = currentFacingMode === "environment" ? "user" : "environment";
  startCamera();
}

function capturePhoto() {
  if (!currentCameraStream || !page.cameraStream.videoWidth) return;

  const video = page.cameraStream;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(blob => {
    if (!blob) {
      showToast("Could not capture image from camera.", "error");
      return;
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const file = new File([blob], `fixlens-cam-${timestamp}.jpg`, { type: "image/jpeg" });
    
    closeCameraModal();
    handleSelectedFile(file);
    showToast("Photo captured successfully!");
  }, "image/jpeg", 0.9);
}

/* =========================================================
   4. DASHBOARD NAVIGATION
   ========================================================= */
const viewNames = {
  overview: "Overview",
  scanner:  "AI Scanner",
  history:  "Scan history",
  safety:   "Safety guidelines",
  about:    "About FixLens AI"
};

function setDashboardView(view) {
  if (!state.user) { showAuth("login"); return; }
  if (!viewNames[view]) return;
  state.currentView = view;
  $$(".dashboard-view").forEach(section =>
    section.classList.toggle("active", section.id === `view-${view}`)
  );
  $$(".side-link[data-dashboard-view]").forEach(button =>
    button.classList.toggle("active", button.dataset.dashboardView === view)
  );
  $("#breadcrumb-current").textContent = viewNames[view];
  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: "smooth" });
  refreshIcons();
}

const mobileQuery = window.matchMedia("(max-width: 760px)");

function syncSidebarAccess() {
  const isOpen = page.sidebar.classList.contains("open");
  page.sidebar.inert = mobileQuery.matches && !isOpen;
  page.menuButton.setAttribute("aria-expanded", String(isOpen));
}

function openMobileSidebar() {
  page.sidebar.classList.add("open");
  page.sidebarBackdrop.classList.remove("hidden");
  syncSidebarAccess();
  page.sidebar.querySelector(".side-link")?.focus();
}

function closeMobileSidebar() {
  page.sidebar.classList.remove("open");
  page.sidebarBackdrop.classList.add("hidden");
  syncSidebarAccess();
}

/* =========================================================
   5. IMAGE UPLOAD AND PREVIEW
   ========================================================= */
function validateImage(file) {
  if (!file)                             return "Choose an image first.";
  if (!ALLOWED_TYPES.includes(file.type)) return "Please use a JPG, PNG, or WEBP image.";
  if (file.size > MAX_IMAGE_SIZE)        return "This image is larger than 8 MB. Choose a smaller image.";
  return null;
}

function handleSelectedFile(file) {
  const error = validateImage(file);
  if (error) { showScannerError(error); return; }
  hideScannerError();
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.selectedFile = file;
  state.previewUrl   = URL.createObjectURL(file);
  page.previewImage.src         = state.previewUrl;
  page.previewFilename.textContent = file.name;
  page.uploadPlaceholder.classList.add("hidden");
  page.imagePreview.classList.remove("hidden");
  page.analyzeButton.disabled = false;
}

function clearSelectedImage() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl   = null;
  state.selectedFile = null;
  page.imageInput.value = "";
  page.previewImage.removeAttribute("src");
  page.imagePreview.classList.add("hidden");
  page.uploadPlaceholder.classList.remove("hidden");
  page.analyzeButton.disabled = true;
}

function showScannerError(message) {
  page.scannerError.textContent = message;
  page.scannerError.classList.remove("hidden");
}
function hideScannerError() {
  page.scannerError.classList.add("hidden");
  page.scannerError.textContent = "";
}

const SCAN_MESSAGES = [
  "Preparing your image...",
  "Looking for visible details...",
  "Checking possible causes...",
  "Assessing how urgent it is...",
  "Writing your step-by-step guide..."
];
let scanMessageTimer = null;

function setScanLoading(loading) {
  page.analyzeButton.disabled = loading || !state.selectedFile;
  page.scanProgress.classList.toggle("hidden", !loading);
  page.imagePreview.classList.toggle("scanning", loading);
  window.clearInterval(scanMessageTimer);

  if (loading) {
    let index = 0;
    page.progressTitle.textContent    = "Analyzing your image...";
    page.progressSubtitle.textContent = SCAN_MESSAGES[0];
    scanMessageTimer = window.setInterval(() => {
      index = Math.min(index + 1, SCAN_MESSAGES.length - 1);
      page.progressSubtitle.textContent = SCAN_MESSAGES[index];
    }, 3500);
  }
}

/* =========================================================
   6. AI DIAGNOSIS
   ========================================================= */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(new Error("Could not read this image. Please choose it again."));
    reader.readAsDataURL(file);
  });
}

// Shrinks large photos before upload (smaller request, faster AI answer).
// Falls back to the original file if anything goes wrong.
async function prepareImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale  = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height));
    // Always re-encode through a canvas: it downsizes AND strips EXIF metadata (GPS location,
    // device info) from the photo before it leaves the browser.

    const canvas = document.createElement("canvas");
    canvas.width  = Math.round(bitmap.width  * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    context.fillStyle = "#ffffff"; // flatten transparent PNGs
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch (error) {
    console.warn("Could not resize image, using the original:", error);
    return file;
  }
}

async function uploadDiagnosisImage(file, userId) {
  const extension = FILE_EXTENSIONS[file.type] || "jpg";
  const safeName  = `${crypto.randomUUID()}.${extension}`;
  const path      = `${userId}/${safeName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Image storage failed: ${error.message}`);
  return path;
}

async function callDiagnosisFunction(file) {
  // BUG 8 fix: always use latest session token
  const { data: { session: freshSession } } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const token = freshSession?.access_token || state.session?.access_token;

  if (!supabase || !token) {
    throw new Error("Your session is missing. Please log in again.");
  }

  const imageBase64 = await fileToBase64(file);
  const endpoint    = `${SUPABASE_URL}/functions/v1/diagnose`;
  const controller  = new AbortController();
  const timer       = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  let response;
  try {
    response = await fetch(endpoint, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey":        SUPABASE_ANON_KEY
      },
      body:   JSON.stringify({ imageBase64, mimeType: file.type, fileName: file.name, category: state.selectedCategory }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("The AI took too long to respond. Please try again.");
    throw new Error("Could not reach the AI service. Check your connection and try again.");
  } finally {
    window.clearTimeout(timer);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    // ADD 6: specific rate-limit message
    if (response.status === 429) {
      throw new Error("You've hit the rate limit. Please wait a moment before trying again.");
    }
    throw new Error(result.error || result.message || `AI service returned an error (${response.status}).`);
  }
  if (!result.diagnosis) {
    throw new Error("The AI response did not contain a diagnosis. Check your Edge Function response format.");
  }
  return normalizeDiagnosis(result.diagnosis);
}

function normalizeList(value, fallback = []) {
  if (Array.isArray(value))                         return value.map(item => String(item)).filter(Boolean).slice(0, 8);
  if (typeof value === "string" && value.trim())    return [value.trim()];
  return fallback;
}

function normalizeDiagnosis(raw) {
  const allowedUrgencies = ["low", "medium", "high", "critical"];
  const urgency = String(raw.urgency || "medium").toLowerCase();
  return {
    object_name:         String(raw.object_name  || "Unidentified household item").slice(0, 120),
    category:            String(raw.category     || "Household item").slice(0, 80),
    problem:             String(raw.problem      || "Possible issue needs further inspection").slice(0, 180),
    summary:             String(raw.summary      || "The image may show an issue, but more information is needed to understand it.").slice(0, 1200),
    urgency:             allowedUrgencies.includes(urgency) ? urgency : "medium",
    confidence:          normalizeConfidence(raw.confidence),
    possible_causes:     normalizeList(raw.possible_causes,     ["The visible image does not provide enough detail to determine the cause."]),
    recommended_actions: normalizeList(raw.recommended_actions, ["Keep a safe distance from the affected area.", "Ask a qualified professional to inspect the item if the issue continues."]),
    safety_notes:        String(raw.safety_notes      || "Do not attempt a repair if you are unsure whether it is safe.").slice(0, 1000),
    professional_help:   String(raw.professional_help || "Contact a qualified professional if the issue persists or involves a safety risk.").slice(0, 1000),
    image_quality_note:  String(raw.image_quality_note || "").slice(0, 500)
  };
}

async function saveDiagnosis(diagnosis, imagePath) {
  const record = {
    user_id:        state.user.id,
    image_path:     imagePath,
    object_name:    diagnosis.object_name,
    problem:        diagnosis.problem,
    urgency:        diagnosis.urgency,
    confidence:     diagnosis.confidence,
    diagnosis_json: diagnosis
  };
  const { data, error } = await supabase
    .from("diagnoses")
    .insert(record)
    .select()
    .single();

  if (error) throw new Error(`Diagnosis was generated but could not be saved: ${error.message}`);
  return data;
}

async function runDiagnosis() {
  if (!state.user || !state.selectedFile) return;
  hideScannerError();
  setScanLoading(true);
  page.diagnosisSection.classList.add("hidden");

  try {
    const file      = await prepareImage(state.selectedFile);
    const diagnosis = await callDiagnosisFunction(file);

    let imagePath = null;
    try {
      imagePath = await uploadDiagnosisImage(file, state.user.id);
    } catch (storageError) {
      console.warn("Storage upload warning:", storageError);
      showToast("Diagnosis generated, but the image could not be saved.", "error");
    }

    let result;
    try {
      const savedRecord = await saveDiagnosis(diagnosis, imagePath);
      // Prefer a stored image URL — the local preview URL is revoked on the next scan.
      const imageUrl = (await getSignedUrl(imagePath)) || state.previewUrl;
      result = { ...savedRecord, diagnosis_json: diagnosis, image_url: imageUrl };
      state.diagnoses.unshift(result);
      state.totalCount += 1;
      showToast("Your diagnosis is ready and saved.");
    } catch (saveError) {
      console.error("FixLens AI save error:", saveError);
      await removeStoredImage(imagePath);
      result = { id: null, diagnosis_json: diagnosis, image_url: state.previewUrl };
      showToast(saveError.message, "error");
    }

    state.currentDiagnosis = result;
    if (!result.id) chatHistories.delete("unsaved"); // a new unsaved result starts a fresh chat
    renderDiagnosis(result, result.image_url);
    updateDashboardStats();
    renderHistory();
    renderRecentScans();
    page.diagnosisSection.classList.remove("hidden");
    page.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error("FixLens AI diagnosis error:", error);
    showScannerError(error.message || "We could not analyze this image. Please try again.");
  } finally {
    setScanLoading(false);
  }
}

/* =========================================================
   7. DIAGNOSIS DISPLAY
   ========================================================= */
function urgencyLabel(level) {
  return ({ low: "Low urgency", medium: "Medium urgency", high: "High urgency", critical: "Critical" })[level] || "Review needed";
}

function renderDiagnosis(record, imageUrl = null) {
  const diagnosis       = normalizeDiagnosis(record.diagnosis_json || record);
  const image           = imageUrl || record.image_url || "";
  const confidence      = normalizeConfidence(diagnosis.confidence);
  const confidenceText  = confidence === null ? "Not available" : `${confidence}% (AI estimate)`;
  const causes          = normalizeList(diagnosis.possible_causes);
  const actions         = normalizeList(diagnosis.recommended_actions);
  const isUnsaved       = !record.id;
  const isSaved         = !isUnsaved && state.savedIds.has(record.id);

  page.diagnosisResult.innerHTML = `
    <article class="diagnosis-card">
      <div class="diagnosis-image">${image
        ? `<img src="${escapeHTML(image)}" alt="Analyzed household item"${record.image_path ? ` data-image-path="${escapeHTML(record.image_path)}"` : ""} />`
        : `<div class="empty-icon"><i data-lucide="image"></i></div>`}</div>
      <div class="diagnosis-body">
        ${isUnsaved ? `<div class="diagnosis-unsaved"><i data-lucide="cloud-off"></i><p>This result could not be saved to your history and will disappear when you leave this page. Note it down now.</p></div>` : ""}
        <div class="diagnosis-topline"><span class="diagnosis-category">${escapeHTML(diagnosis.category || "HOUSEHOLD ITEM")}</span><span class="urgency-badge urgency-${escapeHTML(diagnosis.urgency)}">${escapeHTML(urgencyLabel(diagnosis.urgency))}</span></div>
        <h3>${escapeHTML(diagnosis.object_name)}</h3>
        <p class="diagnosis-summary"><strong>${escapeHTML(diagnosis.problem)}</strong><br />${escapeHTML(diagnosis.summary)}</p>
        <div class="diagnosis-meta"><span class="meta-chip">AI confidence: ${escapeHTML(confidenceText)}</span><span class="meta-chip">Image-based estimate</span></div>
        ${confidence === null ? "" : `<div class="confidence-meter" role="img" aria-label="AI confidence ${confidence} percent"><span data-width="${confidence}"></span></div>`}
        ${diagnosis.image_quality_note ? `<div class="diagnosis-block"><h4><i data-lucide="image"></i> Image note</h4><p>${escapeHTML(diagnosis.image_quality_note)}</p></div>` : ""}
        <div class="diagnosis-block"><h4><i data-lucide="search"></i> Possible causes</h4><ul>${causes.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ul></div>
        <div class="diagnosis-block"><h4><i data-lucide="list-checks"></i> Recommended next steps</h4><ol>${actions.map(item => `<li>${escapeHTML(item)}</li>`).join("")}</ol></div>
        <div class="diagnosis-block"><h4><i data-lucide="shield-check"></i> Safety guidance</h4><p>${escapeHTML(diagnosis.safety_notes)}</p></div>
        <div class="diagnosis-warning"><i data-lucide="alert-triangle"></i><p><strong>When to get professional help</strong><br />${escapeHTML(diagnosis.professional_help)}</p></div>

        <!-- AI CHAT FOLLOW-UP SECTION -->
        <div class="diagnosis-chat-section" id="diagnosis-chat-section">
          <div class="chat-section-header">
            <div class="chat-header-title">
              <span class="chat-sparkle-icon"><i data-lucide="sparkles"></i></span>
              <div>
                <h4>${escapeHTML(translations[currentLang].chat_title)}</h4>
                <p>${escapeHTML(translations[currentLang].chat_sub)}</p>
              </div>
            </div>
          </div>

          <!-- Quick Suggestion Pills -->
          <div class="chat-quick-suggestions">
            <button type="button" class="quick-prompt-pill" data-quick-prompt="${currentLang === 'id' ? 'Berapa perkiraan estimasi biaya perbaikan untuk masalah ini?' : 'What is the estimated repair cost for this issue?'}">${escapeHTML(translations[currentLang].chat_pill_cost)}</button>
            <button type="button" class="quick-prompt-pill" data-quick-prompt="${currentLang === 'id' ? 'Alat dan bahan apa saja yang saya butuhkan untuk memperbaikinya?' : 'What tools and materials do I need to fix this?'}">${escapeHTML(translations[currentLang].chat_pill_tools)}</button>
            <button type="button" class="quick-prompt-pill" data-quick-prompt="${currentLang === 'id' ? 'Apakah aman diperbaiki sendiri atau wajib panggil teknisi?' : 'Is it safe to DIY or should I call a technician?'}">${escapeHTML(translations[currentLang].chat_pill_safety)}</button>
          </div>

          <!-- Message History Container -->
          <div class="chat-messages-container" id="chat-messages-container">
            <div class="chat-bubble ai-bubble welcome-bubble">
              <div class="bubble-avatar"><i data-lucide="wrench"></i></div>
              <div class="bubble-content">
                <p>${currentLang === 'id' ? `Halo! Saya siap bantu jelaskan lebih detail cara memperbaiki <strong>${escapeHTML(diagnosis.object_name)}</strong> ini. Mau tanya apa?` : `Hello! I'm ready to help you with repairing this <strong>${escapeHTML(diagnosis.object_name)}</strong>. What would you like to know?`}</p>
              </div>
            </div>
          </div>

          <!-- Chat Input Form -->
          <form class="chat-input-form" id="chat-input-form">
            <input type="text" id="chat-user-input" placeholder="${escapeHTML(translations[currentLang].chat_placeholder)}" autocomplete="off" maxlength="${MAX_CHAT_LENGTH}" />
            <button type="submit" class="chat-send-btn" id="chat-send-btn" aria-label="Send message" title="Send message">
              <i data-lucide="send"></i>
            </button>
          </form>
        </div>

        <div class="diagnosis-footer">
          <small>AI-generated estimate. Not a professional inspection.</small>
          <div class="diagnosis-footer-actions">
            <button class="button button-outline" type="button" data-copy-diagnosis><i data-lucide="copy"></i>Copy</button>
            <button class="button button-outline" type="button" data-print-diagnosis><i data-lucide="printer"></i>Print</button>
            ${isUnsaved ? "" : `<button class="button button-outline" type="button" data-save-diagnosis="${escapeHTML(record.id)}"><i data-lucide="${isSaved ? "bookmark-check" : "bookmark"}"></i>${isSaved ? "Saved" : "Save result"}</button>`}
          </div>
        </div>
      </div>
    </article>`;
  $$("[data-width]", page.diagnosisResult).forEach(el => { el.style.width = `${Number(el.dataset.width) || 0}%`; });
  restoreChatHistory(record);
  refreshIcons();
}

/* =========================================================
   AI FOLLOW-UP CHAT CONTROLLER
   ========================================================= */
// One conversation per diagnosis: opening another result never leaks the previous chat into it.
const chatHistories = new Map();
let isChatBusy = false;

function chatKey(record = state.currentDiagnosis) {
  return record?.id || "unsaved";
}

function resetFollowUpChat() {
  chatHistories.delete(chatKey());
}

function restoreChatHistory(record) {
  const history = chatHistories.get(chatKey(record)) || [];
  history.forEach(item => appendChatBubble(item.role === "user" ? "user" : "ai", item.text));
}

async function requestChatReply(query, diagnosis, history) {
  const { data: { session: freshSession } } = supabase
    ? await supabase.auth.getSession()
    : { data: { session: null } };
  const token = freshSession?.access_token || state.session?.access_token;
  if (!supabase || !token) return { reply: "" };

  const contextPrompt = `
Object: ${diagnosis.object_name}
Category: ${diagnosis.category}
Issue: ${diagnosis.problem}
Summary: ${diagnosis.summary}
Possible Causes: ${normalizeList(diagnosis.possible_causes).join(", ")}
Recommended Steps: ${normalizeList(diagnosis.recommended_actions).join("; ")}
Safety Notes: ${diagnosis.safety_notes}
`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHAT_TIMEOUT);
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/diagnose`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "apikey": SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        mode: "chat",
        diagnosis_id: state.currentDiagnosis?.id || null, // lets the server load the trusted context itself
        context: contextPrompt,
        message: query,
        history: history.slice(-MAX_CHAT_HISTORY)
      })
    });
    if (res.status === 429) return { reply: "", rateLimited: true };
    if (!res.ok) return { reply: "" };
    const json = await res.json();
    return { reply: String(json.reply || json.answer || json.message || "") };
  } finally {
    clearTimeout(timer);
  }
}

async function handleSendChatMessage(text) {
  const query = text.trim().slice(0, MAX_CHAT_LENGTH);
  if (!query || isChatBusy) return;

  const inputEl = $("#chat-user-input");
  const sendBtn = $("#chat-send-btn");
  const container = $("#chat-messages-container");
  if (!container) return;

  isChatBusy = true;
  const key = chatKey();
  const history = chatHistories.get(key) || [];
  chatHistories.set(key, history);

  if (inputEl) inputEl.value = "";
  if (sendBtn) sendBtn.disabled = true;

  appendChatBubble("user", query);
  history.push({ role: "user", text: query });

  const loadingBubble = appendLoadingBubble();
  container.scrollTop = container.scrollHeight;

  try {
    const diagnosis = normalizeDiagnosis(state.currentDiagnosis?.diagnosis_json || state.currentDiagnosis || {});
    let reply = "";
    try {
      const result = await requestChatReply(query, diagnosis, history);
      if (result.rateLimited) {
        reply = currentLang === "id"
          ? "Terlalu banyak pertanyaan dalam waktu singkat. Tunggu sebentar lalu coba lagi."
          : "You're asking too fast. Please wait a moment and try again.";
      } else {
        reply = result.reply;
      }
    } catch (err) {
      console.warn("Chat request failed, using offline guidance:", err);
    }

    // The offline guidance is generic keyword-based text, not an AI analysis: say so clearly.
    if (!reply) {
      const note = currentLang === "id"
        ? "_Panduan umum offline — bukan analisis AI atas fotomu._\n"
        : "_Offline general guidance, not an AI analysis of your photo._\n";
      reply = note + generateSmartFallbackReply(query, diagnosis);
    }

    loadingBubble.remove();
    appendChatBubble("ai", reply);
    history.push({ role: "assistant", text: reply });
    if (history.length > MAX_CHAT_HISTORY * 2) history.splice(0, history.length - MAX_CHAT_HISTORY * 2);
  } catch (err) {
    loadingBubble.remove();
    appendChatBubble("ai", currentLang === "id"
      ? "Maaf, terjadi gangguan saat menghubungi asisten AI. Silakan coba lagi."
      : "Sorry, something went wrong while contacting the AI assistant. Please try again.");
  } finally {
    isChatBusy = false;
    if (sendBtn) sendBtn.disabled = false;
    if (inputEl) inputEl.focus();
    container.scrollTop = container.scrollHeight;
    refreshIcons();
  }
}

function appendChatBubble(sender, text) {
  const container = $("#chat-messages-container");
  if (!container) return;

  const bubble = document.createElement("div");
  bubble.className = `chat-bubble ${sender === "user" ? "user-bubble" : "ai-bubble"}`;
  
  if (sender === "user") {
    bubble.innerHTML = `
      <div class="bubble-content">
        <p>${escapeHTML(text)}</p>
      </div>`;
  } else {
    // Format simple markdown-like lists & bold
    const formattedText = escapeHTML(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[\s(])[*_]([^*_\n]+)[*_](?=[\s).,:;!?]|$)/g, "$1<em>$2</em>")
      .replace(/\n\s*[-•]\s*(.*?)(?=\n|$)/g, "<br>• $1")
      .replace(/\n/g, "<br>");

    bubble.innerHTML = `
      <div class="bubble-avatar"><i data-lucide="wrench"></i></div>
      <div class="bubble-content">
        <p>${formattedText}</p>
      </div>`;
  }

  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  refreshIcons();
  return bubble;
}

function appendLoadingBubble() {
  const container = $("#chat-messages-container");
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble ai-bubble loading-bubble";
  bubble.innerHTML = `
    <div class="bubble-avatar"><i data-lucide="wrench"></i></div>
    <div class="bubble-content">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(bubble);
  refreshIcons();
  return bubble;
}

function generateSmartFallbackReply(query, d) {
  const q = query.toLowerCase();
  const name = d.object_name || (currentLang === "id" ? "barang ini" : "this item");
  const isId = currentLang === "id";

  if (q.includes("biaya") || q.includes("estimasi") || q.includes("harga") || q.includes("cost") || q.includes("estimate") || q.includes("price")) {
    if (isId) {
      return `Untuk perbaikan **${name}**:
• **Perbaikan Mandiri (DIY):** Kisaran **Rp 20.000 – Rp 80.000** (hanya untuk beli sparepart kecil seperti seal, baut, lem, atau pembersih).
• **Panggil Teknisi / Servis:** Sekitar **Rp 100.000 – Rp 250.000** tergantung tingkat kerumitan dan lokasi.
*Tips:* Jika memerlukan penggantian komponen utama, selalu tanyakan garansi servis ke teknisi terkait.`;
    } else {
      return `Estimated repair cost for **${name}**:
• **DIY (Do It Yourself):** Around **$5 – $15** (minor parts like gaskets, seals, screws, or cleaners).
• **Professional Technician:** Approx. **$40 – $100+** depending on problem severity and labor rates.
*Tip:* Always ask for a service warranty if critical parts are replaced.`;
    }
  }

  if (q.includes("alat") || q.includes("bahan") || q.includes("tool") || q.includes("material")) {
    if (isId) {
      return `Alat dan bahan yang umum disiapkan untuk menangani **${name}**:
1. Obeng plus & minus (+/-) berbagai ukuran.
2. Tang kombinasi atau kunci pas yang sesuai.
3. Kain lap microfiber & wadah kecil untuk menyimpan baut agar tidak hilang.
4. Lampu senter/flash HP untuk melihat bagian celah yang gelap.
Pastikan aliran listrik atau keran air utama sudah dimatikan sebelum mulai!`;
    } else {
      return `Recommended tools and supplies for **${name}**:
1. Phillips & flathead screwdrivers.
2. Adjustable wrench or pliers.
3. Microfiber cleaning cloth & small container for screws.
4. Flashlight to inspect dark corners.
Always disconnect power or shut off the main water valve before starting!`;
    }
  }

  if (q.includes("aman") || q.includes("sendiri") || q.includes("bahaya") || q.includes("safe") || q.includes("diy")) {
    if (isId) {
      return `Tingkat keamanan perbaikan **${name}**:
• **Aman untuk dicoba sendiri jika:** Hanya masalah fisik ringan (baut kendor, kotoran menumpuk, seal karet aus).
• **Wajib panggil profesional jika:** Ada bau gas menyengat, kabel terbakar, percikan listrik, atau kebocoran di balik dinding/pipa tanam.
Keselamatan selalu nomor satu, jangan ragu memanggil ahli jika ragu!`;
    } else {
      return `Safety assessment for **${name}**:
• **Safe for DIY if:** Minor cosmetic/mechanical wear (loose bolts, clogged dirt, worn washer).
• **Call a pro if:** Burning smell, exposed wiring, gas leak, or internal wall pipe bursts.
Safety always comes first—don't hesitate to consult a certified technician!`;
    }
  }

  if (isId) {
    return `Terkait pertanyaan Anda tentang **${name}**:
Berdasarkan diagnosis sebelumnya, masalah utama adalah **${d.problem || "kerusakan umum"}**. 

Langkah yang disarankan adalah memeriksa komponen yang tertera di panduan langkah demi langkah. Jika butuh panduan perbaikan bertahap untuk bagian tertentu, beri tahu saya bagian mana yang ingin diperjelas!`;
  } else {
    return `Regarding your question about **${name}**:
Based on the image diagnosis, the primary issue is **${d.problem || "general wear and tear"}**.

We recommend following the safe steps listed in the guide above. Feel free to ask if you need step-by-step guidance on any specific part!`;
  }
}

/* =========================================================
   8. HISTORY, SAVED RESULTS, AND DASHBOARD STATS
   ========================================================= */
function skeletonRows(count) {
  const row = `<div class="history-item skeleton-item" aria-hidden="true"><span class="skeleton skeleton-thumb"></span><div class="history-info"><span class="skeleton skeleton-line"></span><span class="skeleton skeleton-line short"></span></div></div>`;
  return row.repeat(count);
}

async function loadDiagnoses() {
  if (!supabase || !state.user) return;
  page.recentList.innerHTML  = skeletonRows(3);
  page.historyList.innerHTML = skeletonRows(4);
  const { data, error, count } = await supabase
    .from("diagnoses")
    .select("*", { count: "exact" })
    .eq("user_id", state.user.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Could not load diagnoses:", error);
    showToast("Could not load scan history. Check your database setup.", "error");
    state.diagnoses  = [];
    state.totalCount = 0;
  } else {
    const loadedData = data || [];
    await Promise.all(loadedData.map(async record => {
      if (record.image_path && !record.image_url) {
        record.image_url = await getSignedUrl(record.image_path);
      }
    }));
    state.diagnoses  = loadedData;
    state.totalCount = count ?? loadedData.length;
  }
  await loadSavedIds();
  updateDashboardStats();
  renderHistory();
  renderRecentScans();
}

async function loadSavedIds() {
  if (!supabase || !state.user) return;
  const { data, error } = await supabase
    .from("saved_diagnoses")
    .select("diagnosis_id")
    .eq("user_id", state.user.id);
  if (!error) state.savedIds = new Set((data || []).map(row => row.diagnosis_id));
}

function updateDashboardStats() {
  $("#stat-total").textContent = String(state.totalCount);
  $("#stat-saved").textContent = String(state.savedIds.size);
  const latest = state.diagnoses[0]?.created_at;
  $("#stat-last").textContent = latest
    ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(latest))
    : "—";
}

function formatDate(value) {
  if (!value) return "Date unavailable";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

const URGENCY_RANK = { low: 1, medium: 2, high: 3, critical: 4 };

function getRecordUrgency(record) {
  const level = String(record.urgency || record.diagnosis_json?.urgency || "medium").toLowerCase();
  return URGENCY_RANK[level] ? level : "medium";
}

function renderHistoryItem(record) {
  const diagnosis = record.diagnosis_json || {};
  const title     = record.object_name || diagnosis.object_name || "Household item";
  const problem   = record.problem     || diagnosis.problem     || "Diagnosis saved";
  const urgency   = getRecordUrgency(record);
  const thumb     = record.image_url || "";
  const isSaved   = state.savedIds.has(record.id);
  const id        = escapeHTML(record.id);
  return `
    <article class="history-item" data-urgency="${urgency}">
      <div class="history-thumb">${thumb
        ? `<img src="${escapeHTML(thumb)}" alt=""${record.image_path ? ` data-image-path="${escapeHTML(record.image_path)}"` : ""} />`
        : `<span class="empty-icon"><i data-lucide="image"></i></span>`}</div>
      <div class="history-info"><strong>${escapeHTML(title)}</strong><span>${escapeHTML(problem)}</span></div>
      <span class="urgency-badge urgency-${urgency}">${escapeHTML(urgencyLabel(urgency))}</span>
      <span class="history-date">${escapeHTML(formatDate(record.created_at))}</span>
      <div class="history-item-actions">
        <button type="button" class="${isSaved ? "is-saved" : ""}" title="${isSaved ? "Remove from saved" : "Save diagnosis"}" aria-label="${isSaved ? "Remove from saved" : "Save diagnosis"}" aria-pressed="${isSaved}" data-save-diagnosis="${id}"><i data-lucide="${isSaved ? "bookmark-check" : "bookmark"}"></i></button>
        <button type="button" title="View diagnosis" aria-label="View diagnosis" data-view-diagnosis="${id}"><i data-lucide="arrow-up-right"></i></button>
        <button type="button" title="Delete diagnosis" aria-label="Delete diagnosis" data-delete-diagnosis="${id}"><i data-lucide="trash-2"></i></button>
      </div>
    </article>`;
}

function hasActiveHistoryFilters() {
  return Boolean(state.historyQuery.trim()) || state.historyUrgency !== "all" || state.historySavedOnly;
}

function getFilteredHistory() {
  const query = state.historyQuery.trim().toLowerCase();

  const list = state.diagnoses.filter(record => {
    const diagnosis = record.diagnosis_json || {};
    if (state.historyUrgency !== "all" && getRecordUrgency(record) !== state.historyUrgency) return false;
    if (state.historySavedOnly && !state.savedIds.has(record.id)) return false;
    if (!query) return true;
    return [record.object_name, record.problem, diagnosis.object_name, diagnosis.problem, diagnosis.category]
      .some(value => String(value || "").toLowerCase().includes(query));
  });

  // BUG 2 fix: use explicit, readable sort comparators
  if (state.historySort === "oldest") {
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  } else if (state.historySort === "urgent") {
    list.sort((a, b) =>
      URGENCY_RANK[getRecordUrgency(b)] - URGENCY_RANK[getRecordUrgency(a)] ||
      new Date(b.created_at) - new Date(a.created_at)
    );
  } else {
    // newest first (default)
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  return list;
}

function syncHistoryFilters() {
  $$("[data-history-urgency]").forEach(chip => {
    const active = chip.dataset.historyUrgency === state.historyUrgency;
    chip.classList.toggle("active", active);
    chip.setAttribute("aria-pressed", String(active));
  });

  const savedToggle = $("#history-saved-toggle");
  savedToggle.classList.toggle("active", state.historySavedOnly);
  savedToggle.setAttribute("aria-pressed", String(state.historySavedOnly));

  $("#history-sort").value = state.historySort;
}

function renderHistory() {
  const filtered  = getFilteredHistory();
  const filtering = hasActiveHistoryFilters();
  const total     = state.diagnoses.length;

  syncHistoryFilters();

  let countText = "";
  if (total) {
    countText = filtering
      ? `Showing ${filtered.length} of ${total} scans`
      : `${total} scan${total === 1 ? "" : "s"}`;
    if (state.totalCount > total) countText += ` (your latest ${total} of ${state.totalCount})`;
  }
  $("#history-count").textContent = countText;

  page.historyList.innerHTML = filtered.length
    ? filtered.map(renderHistoryItem).join("")
    : filtering
      ? `<div class="empty-state"><span class="empty-icon"><i data-lucide="search-x"></i></span><strong>No matching scans</strong><p>Try another search term or clear the filters.</p><button class="button button-outline" type="button" data-clear-history-filters>Clear filters</button></div>`
      : `<div class="empty-state"><span class="empty-icon"><i data-lucide="history"></i></span><strong>No scan history yet</strong><p>Your completed scans will show up here.</p></div>`;
  refreshIcons();
}

/* =========================================================
   ADD 3: EXPORT HISTORY AS CSV
   ========================================================= */
// Cells starting with = + - @ (or tab / CR) are executed as formulas by Excel / Sheets.
// The AI reads text from photos, so its output must be treated as untrusted: neutralise it.
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportHistoryCSV() {
  const rows = state.diagnoses.map(r => {
    const d = r.diagnosis_json || {};
    const confidence = d.confidence !== undefined && d.confidence !== null ? `${normalizeConfidence(d.confidence)}%` : "N/A";
    return [
      r.object_name || d.object_name || "",
      r.problem     || d.problem     || "",
      getRecordUrgency(r),
      d.category    || "",
      (r.created_at || "").slice(0, 10),
      confidence
    ].map(csvCell).join(",");
  });
  const csv  = ["Item,Problem,Urgency,Category,Date,Confidence", ...rows].join("\r\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }); // BOM: Excel reads UTF-8 correctly
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `fixlens-ai-history-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("History exported as CSV.");
}

/* =========================================================
   SHARE / COPY / PRINT
   ========================================================= */
function diagnosisToText(diagnosis) {
  const confidence = normalizeConfidence(diagnosis.confidence);
  const causes     = normalizeList(diagnosis.possible_causes);
  const actions    = normalizeList(diagnosis.recommended_actions);

  return [
    `FixLens AI diagnosis: ${diagnosis.object_name}`,
    `Problem: ${diagnosis.problem}`,
    `Urgency: ${urgencyLabel(diagnosis.urgency)}${confidence === null ? "" : ` · AI confidence ${confidence}%`}`,
    "",
    diagnosis.summary,
    "",
    "Possible causes:",
    ...causes.map(item => `- ${item}`),
    "",
    "Recommended next steps:",
    ...actions.map((item, index) => `${index + 1}. ${item}`),
    "",
    `Safety guidance: ${diagnosis.safety_notes}`,
    `When to get professional help: ${diagnosis.professional_help}`,
    "",
    "AI-generated estimate. Not a professional inspection."
  ].join("\n");
}

async function copyDiagnosis() {
  const record = state.currentDiagnosis;
  if (!record) return;
  try {
    await navigator.clipboard.writeText(diagnosisToText(record.diagnosis_json || record));
    showToast("Diagnosis copied to your clipboard.");
  } catch {
    showToast("Could not copy. Try the Print button instead.", "error");
  }
}

function renderRecentScans() {
  const recent = state.diagnoses.slice(0, 3);
  page.recentList.innerHTML = recent.length
    ? recent.map(renderHistoryItem).join("")
    : `<div class="empty-state compact-empty"><span class="empty-icon"><i data-lucide="image-plus"></i></span><strong>No scans yet</strong><p>Your recent diagnoses will appear here.</p><button class="button button-outline" type="button" data-dashboard-view="scanner">Start your first scan</button></div>`;
  refreshIcons();
}

async function toggleSavedDiagnosis(id) {
  if (!supabase || !state.user) return;
  const alreadySaved = state.savedIds.has(id);
  try {
    if (alreadySaved) {
      const { error } = await supabase.from("saved_diagnoses")
        .delete().eq("user_id", state.user.id).eq("diagnosis_id", id);
      if (error) throw error;
      state.savedIds.delete(id);
      showToast("Removed from saved results.");
    } else {
      const { error } = await supabase.from("saved_diagnoses")
        .insert({ user_id: state.user.id, diagnosis_id: id });
      if (error) throw error;
      state.savedIds.add(id);
      showToast("Diagnosis saved for later.");
    }
    updateDashboardStats();
    renderHistory();
    renderRecentScans();
    if (state.currentDiagnosis?.id === id) {
      const record = state.currentDiagnosis;
      renderDiagnosis(record, record.image_url);
    }
  } catch (error) {
    showToast(error.message || "Could not update saved results.", "error");
  }
}

async function deleteDiagnosis(id) {
  if (!supabase || !state.user) return;
  const record = state.diagnoses.find(item => item.id === id);
  if (!record) return;

  // BUG 6 fix: custom non-blocking modal instead of window.confirm()
  const confirmed = await showConfirmModal(
    "Delete this diagnosis?",
    "This will permanently remove the scan from your history. This action cannot be undone."
  );
  if (!confirmed) return;

  try {
    // Remove bookmark first (FK may block the delete), then the row, then the image.
    const { error: savedError } = await supabase.from("saved_diagnoses")
      .delete().eq("diagnosis_id", id).eq("user_id", state.user.id);
    if (savedError) throw savedError;

    const { error } = await supabase.from("diagnoses")
      .delete().eq("id", id).eq("user_id", state.user.id);
    if (error) throw error;

    await removeStoredImage(record.image_path);

    state.diagnoses    = state.diagnoses.filter(item => item.id !== id);
    state.totalCount   = Math.max(0, state.totalCount - 1);
    state.savedIds.delete(id);
    if (state.currentDiagnosis?.id === id) {
      state.currentDiagnosis = null;
      page.diagnosisSection.classList.add("hidden");
    }
    updateDashboardStats();
    renderHistory();
    renderRecentScans();
    showToast("Diagnosis deleted.");
  } catch (error) {
    showToast(error.message || "Could not delete this diagnosis.", "error");
    loadSavedIds().then(updateDashboardStats);
  }
}

async function viewPastDiagnosis(id) {
  const record = state.diagnoses.find(item => item.id === id);
  if (!record) return;
  let imageUrl = record.image_url || null;

  // BUG 3 fix: always try to get a fresh signed URL if image_path exists
  if (record.image_path && supabase) {
    const fresh = await getSignedUrl(record.image_path, 60 * 10);
    if (fresh) imageUrl = fresh;
  }

  state.currentDiagnosis = { ...record, image_url: imageUrl };
  setDashboardView("scanner");
  renderDiagnosis(state.currentDiagnosis, imageUrl);
  page.diagnosisSection.classList.remove("hidden");
  page.diagnosisSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* =========================================================
   9. EVENT LISTENERS
   ========================================================= */
document.addEventListener("click", event => {
  // Category cards on the landing page
  const categoryCard = event.target.closest("[data-category]");
  if (categoryCard) {
    event.preventDefault();
    const categoryName = categoryCard.dataset.category;
    setSelectedCategory(categoryName);
    if (state.user) {
      setDashboardView("scanner");
      showToast(`Ready to inspect: ${categoryName}`);
    } else {
      showAuth("signup");
      showToast(`Sign up or log in to scan: ${categoryName}`);
    }
    return;
  }

  // Category chips inside the scanner
  const pickButton = event.target.closest("[data-pick-category]");
  if (pickButton) {
    const name = pickButton.dataset.pickCategory;
    setSelectedCategory(state.selectedCategory === name ? null : name);
    return;
  }

  // History urgency filters
  const urgencyChip = event.target.closest("[data-history-urgency]");
  if (urgencyChip) {
    state.historyUrgency = urgencyChip.dataset.historyUrgency;
    renderHistory();
    return;
  }

  if (event.target.closest("[data-history-saved]")) {
    state.historySavedOnly = !state.historySavedOnly;
    renderHistory();
    return;
  }

  if (event.target.closest("[data-clear-history-filters]")) {
    resetHistoryFilters();
    return;
  }

  // Copy / Print
  if (event.target.closest("[data-copy-diagnosis]"))  { copyDiagnosis(); return; }
  if (event.target.closest("[data-print-diagnosis]")) { window.print(); return; }

  // Open auth
  const authButton = event.target.closest("[data-open-auth]");
  if (authButton) { showAuth(authButton.dataset.openAuth); return; }

  // Home link
  const homeLink = event.target.closest("[data-home-link], [data-back-home]");
  if (homeLink) {
    event.preventDefault();
    if (state.user) { setDashboardView("overview"); } else { showPage("landing"); }
    return;
  }

  // In-page anchor links (landing nav)
  const hash = event.target.closest('a[href^="#"]')?.getAttribute("href") || "";
  if (hash.length > 1 && !state.user && page.landing.classList.contains("hidden")) {
    const target = document.querySelector(hash);
    if (target) {
      event.preventDefault();
      showPage("landing", { scroll: false });
      requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth" }));
      return;
    }
  }

  // Switch auth mode
  const switchButton = event.target.closest("[data-switch-auth]");
  if (switchButton) { state.authMode = switchButton.dataset.switchAuth; updateAuthMode(); return; }

  // Dashboard navigation
  const viewButton = event.target.closest("[data-dashboard-view]");
  if (viewButton) { event.preventDefault(); setDashboardView(viewButton.dataset.dashboardView); return; }

  // Save diagnosis
  const saveButton = event.target.closest("[data-save-diagnosis]");
  if (saveButton) { toggleSavedDiagnosis(saveButton.dataset.saveDiagnosis); return; }

  // View past diagnosis
  const viewDiagnosisButton = event.target.closest("[data-view-diagnosis]");
  if (viewDiagnosisButton) { viewPastDiagnosis(viewDiagnosisButton.dataset.viewDiagnosis); return; }

  // Delete diagnosis
  const deleteButton = event.target.closest("[data-delete-diagnosis]");
  if (deleteButton) { deleteDiagnosis(deleteButton.dataset.deleteDiagnosis); return; }

  // Quick suggestion pills
  const quickPromptBtn = event.target.closest("[data-quick-prompt]");
  if (quickPromptBtn) {
    const promptText = quickPromptBtn.dataset.quickPrompt;
    handleSendChatMessage(promptText);
    return;
  }

  // Confirm modal buttons (BUG 6 fix)
  if (event.target.id === "confirm-modal-ok")     { closeConfirmModal(true);  return; }
  if (event.target.id === "confirm-modal-cancel") { closeConfirmModal(false); return; }

  // Close modal on backdrop click
  if (event.target === page.confirmModal) { closeConfirmModal(false); return; }
  if (event.target === page.forgotModal)  { closeForgotModal(); return; }
  if (event.target === page.cameraModal)  { closeCameraModal(); return; }

  // Camera buttons
  if (event.target.closest("#open-camera-btn") || event.target.closest("#open-camera-btn-retake")) {
    openCameraModal();
    return;
  }
  if (event.target.closest("#camera-modal-close") || event.target.closest("#camera-cancel-btn")) {
    closeCameraModal();
    return;
  }
  if (event.target.closest("#camera-switch-btn")) {
    switchCamera();
    return;
  }
  if (event.target.closest("#camera-shutter-btn")) {
    capturePhoto();
    return;
  }

  // Forgot password modal (BUG 7 / ADD 1 fix)
  if (event.target.id === "forgot-password-btn") { openForgotModal(); return; }
  if (event.target.id === "forgot-modal-close")  { closeForgotModal(); return; }
  if (event.target.id === "forgot-modal-cancel") { closeForgotModal(); return; }

  // Export history (ADD 3)
  if (event.target.closest("#export-history-btn")) { exportHistoryCSV(); return; }
});

// Escape key: close modals / mobile sidebar
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (!page.confirmModal.classList.contains("hidden")) { closeConfirmModal(false); return; }
    if (!page.forgotModal.classList.contains("hidden"))  { closeForgotModal(); return; }
    if (!page.cameraModal.classList.contains("hidden"))  { closeCameraModal(); return; }
    if (page.sidebar.classList.contains("open")) { closeMobileSidebar(); page.menuButton.focus(); }
  }
});

// BUG 3 fix: expired signed URL retry (using data-image-path attribute)
document.addEventListener("error", async event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement)) return;
  const path = image.dataset.imagePath;
  if (!path || image.dataset.retried) return;
  image.dataset.retried = "true";

  const freshUrl = await getSignedUrl(path);
  if (!freshUrl) return;
  image.src = freshUrl;
  state.diagnoses.forEach(record => { if (record.image_path === path) record.image_url = freshUrl; });
  if (state.currentDiagnosis?.image_path === path) state.currentDiagnosis.image_url = freshUrl;
}, true);

// Language toggle listener
document.addEventListener("click", event => {
  if (event.target.closest("#lang-toggle-landing") || event.target.closest("#lang-toggle-dashboard")) {
    const nextLang = currentLang === "id" ? "en" : "id";
    setLanguage(nextLang);
    showToast(nextLang === "id" ? "Bahasa diubah ke Indonesia 🇮🇩" : "Language switched to English 🇬🇧");
    return;
  }
});

// Theme toggles
$$(".theme-toggle").forEach(button => {
  button.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    setTheme(next);
  });
});

// Chat form submission
document.addEventListener("submit", event => {
  if (event.target && event.target.id === "chat-input-form") {
    event.preventDefault();
    const input = $("#chat-user-input");
    if (input && input.value) {
      handleSendChatMessage(input.value);
    }
  }
});

page.authForm.addEventListener("submit", handleAuthSubmit);
$("#forgot-form").addEventListener("submit", handleForgotSubmit);
$("#logout-button").addEventListener("click", logout);
$("#browse-image").addEventListener("click", () => page.imageInput.click());

// BUG 5 fix: "Change" button opens file picker even when image is already selected
$("#change-image").addEventListener("click", () => page.imageInput.click());

page.imageInput.addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (file) handleSelectedFile(file);
});
$("#remove-image").addEventListener("click", clearSelectedImage);
page.analyzeButton.addEventListener("click", runDiagnosis);
$("#new-scan-button").addEventListener("click", () => {
  clearSelectedImage();
  setSelectedCategory(null);
  page.diagnosisSection.classList.add("hidden");
  hideScannerError();
  setDashboardView("scanner");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#history-sort").addEventListener("change", event => {
  state.historySort = event.target.value;
  renderHistory();
});

// MOD 5: debounce search input
let _searchDebounceTimer = null;
$("#history-search").addEventListener("input", event => {
  window.clearTimeout(_searchDebounceTimer);
  _searchDebounceTimer = window.setTimeout(() => {
    state.historyQuery = event.target.value;
    renderHistory();
  }, SEARCH_DEBOUNCE_MS);
});

$("#mobile-menu-button").addEventListener("click", openMobileSidebar);
$("#sidebar-backdrop").addEventListener("click", closeMobileSidebar);
mobileQuery.addEventListener("change", syncSidebarAccess);

// Drag-and-drop
page.uploadZone.addEventListener("dragover", event => {
  event.preventDefault();
  page.uploadZone.classList.add("drag-over");
});
page.uploadZone.addEventListener("dragleave", () => page.uploadZone.classList.remove("drag-over"));
page.uploadZone.addEventListener("drop", event => {
  event.preventDefault();
  page.uploadZone.classList.remove("drag-over");
  const file = event.dataTransfer.files?.[0];
  if (file) handleSelectedFile(file);
});

// Upload zone drag-and-drop & click handler
page.uploadZone.addEventListener("click", event => {
  // Jika klik tombol kamera atau file, biarkan handler masing-masing tombol yang jalan
  if (event.target.closest("#open-camera-btn") || event.target.closest("#open-camera-btn-retake")) return;
  if (event.target.closest("#browse-image") || event.target.closest("#change-image")) return;
  if (event.target.closest("#remove-image")) return;

  // Jika klik di area kosong upload zone dan belum ada gambar, trigger file picker default
  if (!state.selectedFile && !event.target.closest(".image-preview")) {
    page.imageInput.click();
  }
});

// Keyboard users activate the real <button>s inside the zone (camera / browse); a zone-level
// Enter/Space handler would hijack those buttons, so none is registered here.

// Dropping a file outside the zone would make the browser navigate away to the image.
["dragover", "drop"].forEach(name => window.addEventListener(name, event => {
  if (!page.uploadZone.contains(event.target)) event.preventDefault();
}));

// Set-new-password form (password-reset email flow)
$("#recovery-form")?.addEventListener("submit", handleRecoverySubmit);

// Password show/hide toggle
$(".password-toggle").addEventListener("click", event => {
  const input       = $("#auth-password");
  const isPassword  = input.type === "password";
  input.type        = isPassword ? "text" : "password";
  event.currentTarget.innerHTML = `<i data-lucide="${isPassword ? "eye-off" : "eye"}"></i>`;
  event.currentTarget.setAttribute("aria-label", isPassword ? "Hide password" : "Show password");
  refreshIcons();
});

/* =========================================================
   10. APP INITIALIZATION
   ========================================================= */
async function initializeApp() {
  $("#footer-year").textContent = new Date().getFullYear();
  initTheme();
  setLanguage(currentLang);
  syncOfflineBanner();
  syncSidebarAccess();
  initScrollReveal();
  refreshIcons();

  if (!supabase) {
    console.info("FixLens AI: Add Supabase URL and anon key in script.js to enable authentication and data.");
    showPage("landing");
    return;
  }

  // Register the listener BEFORE reading the session so no event (e.g. PASSWORD_RECOVERY) is missed.
  // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock the client.
  supabase.auth.onAuthStateChange((event, sessionValue) => {
    if (event === "SIGNED_OUT") {
      resetUserState();
      clearSelectedImage();
      showPage("landing");
    } else if (event === "PASSWORD_RECOVERY") {
      if (sessionValue?.user) { state.session = sessionValue; state.user = sessionValue.user; }
      openRecoveryModal();
    } else if (sessionValue?.user) {
      state.session = sessionValue;
      state.user    = sessionValue.user;
    }
  });

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.error("Could not read auth session:", error);

  if (session?.user) {
    state.session = session;
    state.user    = session.user;
    await enterDashboard();
    if (openedFromRecoveryLink) openRecoveryModal();
  } else {
    showPage("landing");
  }
}

initializeApp().catch(error => {
  console.error("FixLens AI failed to start:", error);
  showPage("landing");
});
