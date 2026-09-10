(function () {
  var STORAGE_KEY = "nav-theme"; // 'light' | 'dark' | 'system'
  var HIDE_DELAY = 500; // 鼠标离开后菜单延迟消失（毫秒）

  // Tabler 风格 SVG 图标（与模板中一致）
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

  document.addEventListener("DOMContentLoaded", function () {
    var pref = getPreference();
    syncUI(pref);

    document.querySelectorAll(".theme-dropdown").forEach(function (root) {
      var trigger = root.querySelector(".theme-trigger");
      var hideTimer = null;

      function showMenu() {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        root.classList.add("menu-visible");
        if (trigger) trigger.setAttribute("aria-expanded", "true");
      }

      function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          root.classList.remove("menu-visible");
          if (trigger) trigger.setAttribute("aria-expanded", "false");
          hideTimer = null;
        }, HIDE_DELAY);
      }

      // 鼠标进入 trigger / 菜单 → 显示并取消隐藏
      root.addEventListener("mouseenter", showMenu);
      // 鼠标离开整个 dropdown 区域 → 1 秒后隐藏
      root.addEventListener("mouseleave", scheduleHide);

      // 单击 trigger → 在 light / dark 之间切换
      if (trigger) {
        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          var current = getPreference();
          var effective = current === "system" ? systemTheme() : current;
          var next = effective === "dark" ? "light" : "dark";
          setPreference(next);
          showMenu(); // 切换后保持菜单可见，方便继续选择
        });
      }

      // 点击菜单项 → 设定主题并隐藏
      root.querySelectorAll(".theme-menu-item").forEach(function (item) {
        item.addEventListener("click", function (e) {
          e.stopPropagation();
          setPreference(item.getAttribute("data-theme-option"));
          root.classList.remove("menu-visible");
          if (trigger) trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key !== "Escape") return;
      document.querySelectorAll(".theme-dropdown.menu-visible").forEach(function (root) {
        root.classList.remove("menu-visible");
        var t = root.querySelector(".theme-trigger");
        if (t) t.setAttribute("aria-expanded", "false");
      });
    });
  });

  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      if (getPreference() === "system") applyEffectiveTheme("system");
    });
  }
})();