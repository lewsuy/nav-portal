(function () {
  var HIDE_DELAY = 500; // 与主题菜单一致：鼠标离开后延迟消失

  document.addEventListener("DOMContentLoaded", function () {
    var dropdown = document.getElementById("adminDropdown");
    var trigger = document.getElementById("adminTrigger");

    // ---- 悬停下拉菜单（复用主题菜单的交互节奏）----
    if (dropdown && trigger) {
      var hideTimer = null;

      function showMenu() {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        dropdown.classList.add("menu-visible");
        trigger.setAttribute("aria-expanded", "true");
      }

      function scheduleHide() {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          dropdown.classList.remove("menu-visible");
          trigger.setAttribute("aria-expanded", "false");
          hideTimer = null;
        }, HIDE_DELAY);
      }

      dropdown.addEventListener("mouseenter", showMenu);
      dropdown.addEventListener("mouseleave", scheduleHide);

      // 「管理后台」菜单项：当前页跳转（<a> 无 target，天然同页）
      var menuLink = dropdown.querySelector(".theme-menu-item[href]");
      if (menuLink) {
        menuLink.addEventListener("click", function () {
          if (hideTimer) clearTimeout(hideTimer);
          dropdown.classList.remove("menu-visible");
        });
      }
    }

    // ---- 登录卡片（未登录时点击图标弹出）----
    var overlay = document.getElementById("frontLoginOverlay");
    if (!overlay || !trigger) return;

    var form = document.getElementById("frontLoginForm");
    var userInput = document.getElementById("frontLoginUser");
    var passInput = document.getElementById("frontLoginPass");
    var errEl = document.getElementById("frontLoginError");
    var cancelBtn = document.getElementById("frontLoginCancel");
    var submitBtn = document.getElementById("frontLoginSubmit");

    function openModal() {
      if (dropdown) dropdown.classList.remove("menu-visible");
      errEl.textContent = "";
      form.reset();
      overlay.hidden = false;
      userInput.focus();
    }

    function closeModal() {
      overlay.hidden = true;
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      // 已登录：点击图标直接进后台（当前页跳转）
      if (dropdown && dropdown.getAttribute("data-logged-in") === "1") {
        location.href = "/admin";
        return;
      }
      openModal();
    });

    // 点击遮罩关闭，点击卡片内部不关闭（防止误丢输入）
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeModal();
    });
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !overlay.hidden) closeModal();
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errEl.textContent = "";
      var username = userInput.value.trim();
      var password = passInput.value;
      if (!username || !password) {
        errEl.textContent = "请输入用户名和密码";
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "登录中…";

      fetch("/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username, password: password }),
      })
        .then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok) throw new Error(j.error || "登录失败");
            return j;
          });
        })
        .then(function () {
          // 登录成功：留在前台，刷新后私有分类即可见
          location.reload();
        })
        .catch(function (err) {
          errEl.textContent = err.message;
          submitBtn.disabled = false;
          submitBtn.textContent = "登录";
          passInput.focus();
          passInput.select();
        });
    });
  });
})();
