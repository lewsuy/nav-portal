(function () {
  "use strict";

  var toastEl = document.getElementById("toast");
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  function api(url, method, body) {
    return fetch(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || "请求失败"); });
      return r.json();
    });
  }

  function openModal(el) { el.classList.add("open"); }
  function closeModal(el) { el.classList.remove("open"); }

  document.querySelectorAll("[data-close]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      btn.closest(".overlay").classList.remove("open");
    });
  });
  document.querySelectorAll(".overlay").forEach(function (ov) {
    ov.addEventListener("click", function (e) {
      if (e.target === ov) closeModal(ov);
    });
  });

  // ---------- 分类：新建/编辑 ----------

  var categoryModal = document.getElementById("categoryModal");
  var categoryNameInput = document.getElementById("categoryNameInput");
  var categoryModalTitle = document.getElementById("categoryModalTitle");
  var categorySaveBtn = document.getElementById("categorySaveBtn");
  var editingCategoryId = null;

  document.getElementById("addCategoryBtn").addEventListener("click", function () {
    editingCategoryId = null;
    categoryModalTitle.textContent = "新建分类";
    categoryNameInput.value = "";
    openModal(categoryModal);
    categoryNameInput.focus();
  });

  document.querySelectorAll(".edit-cat-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var catEl = btn.closest(".admin-cat");
      editingCategoryId = catEl.dataset.id;
      categoryModalTitle.textContent = "编辑分类";
      categoryNameInput.value = catEl.querySelector(".cat-title").textContent;
      openModal(categoryModal);
      categoryNameInput.focus();
    });
  });

  categorySaveBtn.addEventListener("click", function () {
    var name = categoryNameInput.value.trim();
    if (!name) { toast("分类名称不能为空"); return; }
    var req = editingCategoryId
      ? api("/admin/api/categories/" + editingCategoryId, "PUT", { name: name })
      : api("/admin/api/categories", "POST", { name: name });
    req.then(function () { location.reload(); }).catch(function (e) { toast(e.message); });
  });

  document.querySelectorAll(".delete-cat-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var catEl = btn.closest(".admin-cat");
      var name = catEl.querySelector(".cat-title").textContent;
      if (!confirm("删除分类「" + name + "」及其下所有网址？此操作不可撤销。")) return;
      api("/admin/api/categories/" + catEl.dataset.id, "DELETE")
        .then(function () { location.reload(); })
        .catch(function (e) { toast(e.message); });
    });
  });

  // ---------- 网址：新建/编辑 ----------

  var linkModal = document.getElementById("linkModal");
  var linkModalTitle = document.getElementById("linkModalTitle");
  var linkCategorySelect = document.getElementById("linkCategorySelect");
  var linkNameInput = document.getElementById("linkNameInput");
  var linkUrlInput = document.getElementById("linkUrlInput");
  var linkSaveBtn = document.getElementById("linkSaveBtn");
  var editingLinkId = null;

  document.querySelectorAll(".add-link-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var catEl = btn.closest(".admin-cat");
      editingLinkId = null;
      linkModalTitle.textContent = "新建网址";
      linkNameInput.value = "";
      linkUrlInput.value = "";
      linkCategorySelect.value = catEl.dataset.id;
      openModal(linkModal);
      linkNameInput.focus();
    });
  });

  document.querySelectorAll(".edit-link-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var itemEl = btn.closest(".link-item");
      var catEl = btn.closest(".admin-cat");
      editingLinkId = itemEl.dataset.id;
      linkModalTitle.textContent = "编辑网址";
      linkNameInput.value = itemEl.querySelector(".link-name").textContent;
      linkUrlInput.value = itemEl.querySelector(".link-url").textContent;
      linkCategorySelect.value = catEl.dataset.id;
      openModal(linkModal);
      linkNameInput.focus();
    });
  });

  linkSaveBtn.addEventListener("click", function () {
    var name = linkNameInput.value.trim();
    var url = linkUrlInput.value.trim();
    var categoryId = linkCategorySelect.value;
    if (!name || !url) { toast("名称和网址不能为空"); return; }

    linkSaveBtn.disabled = true;
    linkSaveBtn.textContent = "保存中…（正在抓取图标）";

    var req = editingLinkId
      ? api("/admin/api/links/" + editingLinkId, "PUT", { name: name, url: url })
      : api("/admin/api/links", "POST", { name: name, url: url, category_id: Number(categoryId) });

    req.then(function () { location.reload(); })
      .catch(function (e) {
        toast(e.message);
        linkSaveBtn.disabled = false;
        linkSaveBtn.textContent = "保存";
      });
  });

  document.querySelectorAll(".delete-link-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var itemEl = btn.closest(".link-item");
      var name = itemEl.querySelector(".link-name").textContent;
      if (!confirm("删除网址「" + name + "」？")) return;
      api("/admin/api/links/" + itemEl.dataset.id, "DELETE")
        .then(function () { location.reload(); })
        .catch(function (e) { toast(e.message); });
    });
  });

  // ---------- 修改密码弹窗 ----------

  document.getElementById("changePwdBtn").addEventListener("click", function (e) {
    e.preventDefault();
    openModal(document.getElementById("pwdModal"));
  });

  // ---------- 拖拽排序 ----------

  function enableSortable(container, itemSelector, onReorder, stop) {
    var dragEl = null;

    container.addEventListener("dragstart", function (e) {
      var item = e.target.closest(itemSelector);
      if (!item || item.parentElement !== container) return;
      if (stop) e.stopPropagation();
      dragEl = item;
      item.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    container.addEventListener("dragover", function (e) {
      if (!dragEl) return;
      if (stop) e.stopPropagation();
      e.preventDefault();
      var target = e.target.closest(itemSelector);
      if (!target || target === dragEl || target.parentElement !== container) return;
      container.querySelectorAll(itemSelector).forEach(function (el) {
        el.classList.remove("drag-over-top", "drag-over-bottom");
      });
      var rect = target.getBoundingClientRect();
      var before = e.clientY - rect.top < rect.height / 2;
      target.classList.add(before ? "drag-over-top" : "drag-over-bottom");
      container.insertBefore(dragEl, before ? target : target.nextSibling);
    });

    container.addEventListener("dragend", function (e) {
      if (!dragEl) return;
      if (stop) e.stopPropagation();
      dragEl.classList.remove("dragging");
      container.querySelectorAll(itemSelector).forEach(function (el) {
        el.classList.remove("drag-over-top", "drag-over-bottom");
      });
      var ids = Array.prototype.slice
        .call(container.querySelectorAll(itemSelector))
        .map(function (el) { return el.dataset.id; });
      dragEl = null;
      onReorder(ids);
    });
  }

  var categoryList = document.getElementById("categoryList");
  if (categoryList) {
    enableSortable(categoryList, ".admin-cat", function (ids) {
      api("/admin/api/categories/reorder", "POST", { order: ids }).catch(function (e) { toast(e.message); });
    }, false);
  }

  document.querySelectorAll(".link-list").forEach(function (list) {
    enableSortable(list, ".link-item", function (ids) {
      api("/admin/api/links/reorder", "POST", {
        category_id: Number(list.dataset.catId),
        order: ids,
      }).catch(function (e) { toast(e.message); });
    }, true);
  });
})();
