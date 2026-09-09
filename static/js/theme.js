(function () {
  var STORAGE_KEY = "nav-theme"; // 'light' | 'dark' | 'system'
  var ICONS = { light: "☀️", dark: "🌙", system: "💻" };

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
    document.querySelectorAll(".theme-menu-item").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-theme-option") === pref);
    });
    document.querySelectorAll(".theme-trigger-icon").forEach(function (icon) {
      icon.textContent = ICONS[pref] || ICONS.system;
    });
  }

  function setPreference(pref) {
    try {
      localStorage.setItem(STORAGE_KEY, pref);
    } catch (e) {}
    applyEffectiveTheme(pref);
    syncUI(pref);
  }

  function closeAllMenus() {
    document.querySelectorAll(".theme-menu.open").forEach(function (menu) {
      menu.classList.remove("open");
    });
    document.querySelectorAll('.theme-trigger[aria-expanded="true"]').forEach(function (trigger) {
      trigger.setAttribute("aria-expanded", "false");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var pref = getPreference();
    syncUI(pref);

    document.querySelectorAll(".theme-trigger").forEach(function (trigger) {
      trigger.addEventListener("click", function (e) {
        e.stopPropagation();
        var menu = trigger.parentElement.querySelector(".theme-menu");
        var wasOpen = menu.classList.contains("open");
        closeAllMenus();
        if (!wasOpen) {
          menu.classList.add("open");
          trigger.setAttribute("aria-expanded", "true");
        }
      });
    });

    document.querySelectorAll(".theme-menu-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        e.stopPropagation();
        setPreference(item.getAttribute("data-theme-option"));
        closeAllMenus();
      });
    });

    document.addEventListener("click", closeAllMenus);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeAllMenus();
    });
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      if (getPreference() === "system") applyEffectiveTheme("system");
    });
  }
})();
