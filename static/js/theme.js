(function () {
  var STORAGE_KEY = "nav-theme"; // 'light' | 'dark' | 'system'

  // Tabler 风格 SVG 图标（path d 内容与模板一致）
  var ICONS = {
    light:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 12m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"></path>' +
        '<path d="M12 3l0 2"></path>' +
        '<path d="M12 19l0 2"></path>' +
        '<path d="M3 12l2 0"></path>' +
        '<path d="M19 12l2 0"></path>' +
        '<path d="M5.6 5.6l1.4 1.4"></path>' +
        '<path d="M17 17l1.4 1.4"></path>' +
        '<path d="M5.6 18.4l1.4 -1.4"></path>' +
        '<path d="M17 7l1.4 -1.4"></path>' +
      '</svg>',
    dark:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1 -9 -9"></path>' +
      '</svg>',
    system:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        '<rect x="3" y="4" width="18" height="12" rx="1"></rect>' +
        '<path d="M8 20h8"></path>' +
        '<path d="M12 16v4"></path>' +
      '</svg>'
  };

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
    document.querySelectorAll(".theme-trigger-icon").forEach(function (slot) {
      slot.innerHTML = ICONS[pref] || ICONS.system;
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