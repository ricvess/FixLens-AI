// Runs before first paint (loaded synchronously from <head>): applies the saved theme
// and flags a stored login session so the page does not flash the landing screen.
try {
  var root = document.documentElement;
  // One-time migration of the old "fixit-*" keys to the new FixLens names.
  ["theme", "lang"].forEach(function (k) {
    var old = localStorage.getItem("fixit-" + k);
    if (old !== null && localStorage.getItem("fixlens-" + k) === null) localStorage.setItem("fixlens-" + k, old);
    localStorage.removeItem("fixit-" + k);
  });
  if (localStorage.getItem("fixlens-theme") === "dark") {
    root.dataset.theme = "dark";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", "#111a18");
  }
  var hasStoredSession = Object.keys(localStorage).some(function (key) {
    return /^sb-.+-auth-token$/.test(key);
  });
  if (hasStoredSession) {
    root.classList.add("restoring-session");
    // Safety net: never leave the page blank if the app script fails to load.
    setTimeout(function () { root.classList.remove("restoring-session"); }, 6000);
  }
} catch (error) {}
