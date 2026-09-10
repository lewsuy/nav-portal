(function () {
  var STORAGE_KEY = "nav-theme"; // 'light' | 'dark' | 'system'

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  }

  function getPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) || "system";
    } catch (e) {
      return "system";
    }
  }

  function applyEffectiveTheme(pref) {
    var effective = pref === "system" ? systemTheme() : pref;
    document.documentElement.setAttribute("data-theme", effective);
  }

  function syncUI(pref) {
    document.querySelectorAll(".theme-icon-btn").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme-option") === pref);
    });
  }

  function setPreference(pref) {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch (e) {}
    applyEffectiveTheme(pref);
    syncUI(pref);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pref = getPreference();
    syncUI(pref);

    document.querySelectorAll(".theme-icon-btn").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var opt = btn.getAttribute("data-theme-option");
        if (opt) setPreference(opt);
      });
    });
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      if (getPreference() === "system") applyEffectiveTheme("system");
    });
  }
})();