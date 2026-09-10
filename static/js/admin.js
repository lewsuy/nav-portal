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
  // 点击遮罩不关闭弹窗，避免填写内容误丢；仅通过「取消」/「保存」按钮关闭

  // ---------- 分类：新建/编辑 ----------

  var categoryModal = document.getElementById("categoryModal");
  var categoryNameInput = document.getElementById("categoryNameInput");
  var categoryPrivateInput = document.getElementById("categoryPrivateInput");
  var categoryModalTitle = document.getElementById("categoryModalTitle");
  var categorySaveBtn = document.getElementById("categorySaveBtn");
  var editingCategoryId = null;

  document.getElementById("addCategoryBtn").addEventListener("click", function () {
    editingCategoryId = null;
    categoryModalTitle.textContent = "新建分类";
    categoryNameInput.value = "";
    categoryPrivateInput.checked = false;
    openModal(categoryModal);
    categoryNameInput.focus();
  });

  document.querySelectorAll(".edit-cat-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var catEl = btn.closest(".admin-cat");
      editingCategoryId = catEl.dataset.id;
      categoryModalTitle.textContent = "编辑分类";
      categoryNameInput.value = catEl.querySelector(".cat-title").textContent;
      categoryPrivateInput.checked = catEl.dataset.private === "1";
      openModal(categoryModal);
      categoryNameInput.focus();
    });
  });

  categorySaveBtn.addEventListener("click", function () {
    var name = categoryNameInput.value.trim();
    if (!name) { toast("分类名称不能为空"); return; }
    var payload = { name: name, is_private: categoryPrivateInput.checked };
    var req = editingCategoryId
      ? api("/admin/api/categories/" + editingCategoryId, "PUT", payload)
      : api("/admin/api/categories", "POST", payload);
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
  var linkIconUrlInput = document.getElementById("linkIconUrlInput");
  var linkIconFileInput = document.getElementById("linkIconFileInput");
  var linkIconPreview = document.getElementById("linkIconPreview");
  var linkIconDeleteBtn = document.getElementById("linkIconDeleteBtn");
  var linkIconUploadText = document.getElementById("linkIconUploadText");
  var editingLinkId = null;
  var uploadedIconPath = null;   // 选择文件后立即上传得到的路径
  var iconRemove = false;        // 点击「删除图标」后置位
  var initialIconValue = "";     // 打开弹窗时图标链接输入框的初始值

  function refreshDeleteBtn() {
    var hasIcon = linkIconPreview.hidden === false || uploadedIconPath || iconRemove;
    linkIconDeleteBtn.classList.toggle("disabled", !hasIcon);
  }

  function resetIconPicker(previewSrc, pathValue) {
    linkIconFileInput.value = "";
    uploadedIconPath = null;
    iconRemove = false;
    initialIconValue = pathValue || "";
    linkIconUrlInput.value = initialIconValue;
    showIconPreview(previewSrc || null);
  }

  function showIconPreview(src) {
    if (src) {
      linkIconPreview.src = src;
      linkIconPreview.hidden = false;
    } else {
      linkIconPreview.hidden = true;
    }
    refreshDeleteBtn();
  }

  linkIconUrlInput.addEventListener("input", function () {
    var v = linkIconUrlInput.value.trim();
    if (v !== uploadedIconPath) uploadedIconPath = null; // 手动改写则丢弃已上传结果
    if (v) iconRemove = false;                            // 填了新链接视为替换而非删除
    showIconPreview(v || null);
  });

  // 选择文件后立即上传，成功后回填路径并预览
  linkIconFileInput.addEventListener("change", function () {
    var f = linkIconFileInput.files[0];
    if (!f) return;
    linkIconUploadText.textContent = "上传中…";
    linkIconFileInput.disabled = true;
    var fd = new FormData();
    fd.append("icon_file", f);
    fetch("/admin/api/upload-icon", { method: "POST", body: fd })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (e) { throw new Error(e.error || "上传失败"); });
        return r.json();
      })
      .then(function (data) {
        uploadedIconPath = data.icon;
        iconRemove = false;
        initialIconValue = data.icon;
        linkIconUrlInput.value = data.icon;
        showIconPreview("/static/" + data.icon);
      })
      .catch(function (e) { toast(e.message); })
      .finally(function () {
        linkIconUploadText.textContent = "上传图标";
        linkIconFileInput.disabled = false;
        linkIconFileInput.value = "";
      });
  });

  linkIconDeleteBtn.addEventListener("click", function () {
    if (linkIconDeleteBtn.classList.contains("disabled")) return;
    iconRemove = true;
    uploadedIconPath = null;
    initialIconValue = "";
    linkIconUrlInput.value = "";
    linkIconFileInput.value = "";
    showIconPreview(null);
  });

  function buildIconFields(payload) {
    var v = linkIconUrlInput.value.trim();
    if (uploadedIconPath) {
      payload.icon_path = uploadedIconPath;
    } else if (/^https?:\/\//i.test(v)) {
      payload.icon_url = v;
    } else if (v && v !== initialIconValue && v.indexOf("icons/") === 0) {
      payload.icon_url = v; // 直接填了已存在的图标路径
    }
    if (iconRemove && !payload.icon_path && !payload.icon_url) {
      payload.icon_remove = "1";
    }
    return payload;
  }

  document.querySelectorAll(".add-link-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var catEl = btn.closest(".admin-cat");
      editingLinkId = null;
      linkModalTitle.textContent = "新建网址";
      linkNameInput.value = "";
      linkUrlInput.value = "";
      resetIconPicker(null, "");
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
      var curImg = itemEl.querySelector("img");
      var curPath = "";
      if (curImg) {
        curPath = (curImg.getAttribute("src") || "").replace(/^.*\/static\//, "");
      }
      resetIconPicker(curImg ? curImg.getAttribute("src") : null, curPath);
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

    var payload = editingLinkId
      ? { name: name, url: url }
      : { name: name, url: url, category_id: Number(categoryId) };
    buildIconFields(payload);

    linkSaveBtn.disabled = true;
    linkSaveBtn.textContent = payload.icon_path || payload.icon_url
      ? "保存中…（正在处理图标）"
      : payload.icon_remove
        ? "保存中…（正在删除图标）"
        : "保存中…（正在抓取图标）";

    var req = editingLinkId
      ? api("/admin/api/links/" + editingLinkId, "PUT", payload)
      : api("/admin/api/links", "POST", payload);

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

  var pwdModal = document.getElementById("pwdModal");
  var pwdForm = document.getElementById("pwdForm");
  var oldPasswordInput = document.getElementById("oldPasswordInput");
  var newPasswordInput = document.getElementById("newPasswordInput");
  var confirmPasswordInput = document.getElementById("confirmPasswordInput");
  var pwdSubmitBtn = document.getElementById("pwdSubmitBtn");

  function setPwdError(id, msg) {
    document.getElementById(id).textContent = msg || "";
  }

  function clearPwdErrors() {
    ["oldPwdError", "newPwdError", "confirmPwdError"].forEach(function (id) {
      setPwdError(id, "");
    });
  }

  document.getElementById("changePwdBtn").addEventListener("click", function (e) {
    e.preventDefault();
    clearPwdErrors();
    pwdForm.reset();
    openModal(pwdModal);
    oldPasswordInput.focus();
  });

  // 修改密码成功对话框：X 手动关闭 / 2 秒自动关闭
  var pwdSuccessModal = document.getElementById("pwdSuccessModal");
  var pwdSuccessTimer = null;

  function closePwdSuccess() {
    if (pwdSuccessTimer) { clearTimeout(pwdSuccessTimer); pwdSuccessTimer = null; }
    closeModal(pwdSuccessModal);
  }

  document.getElementById("pwdSuccessClose").addEventListener("click", closePwdSuccess);

  pwdForm.addEventListener("submit", function (e) {
    e.preventDefault();
    clearPwdErrors();

    var oldPwd = oldPasswordInput.value;
    var newPwd = newPasswordInput.value;
    var confirmPwd = confirmPasswordInput.value;

    var hasError = false;
    if (!oldPwd) { setPwdError("oldPwdError", "请输入原密码"); hasError = true; }
    if (newPwd.length < 6) { setPwdError("newPwdError", "至少6位"); hasError = true; }
    if (newPwd && confirmPwd && newPwd !== confirmPwd) {
      setPwdError("confirmPwdError", "两次输入不一致");
      hasError = true;
    }
    if (hasError) return;

    pwdSubmitBtn.disabled = true;
    pwdSubmitBtn.textContent = "提交中…";

    api("/admin/change-password", "POST", {
      old_password: oldPwd,
      new_password: newPwd,
      confirm_password: confirmPwd,
    })
      .then(function () {
        closeModal(pwdModal);
        pwdForm.reset();
        openModal(pwdSuccessModal);
        pwdSuccessTimer = setTimeout(closePwdSuccess, 2000);
      })
      .catch(function (err) {
        var msg = err.message || "修改失败";
        if (msg.indexOf("原密码") !== -1 || msg.indexOf("旧密码") !== -1) {
          setPwdError("oldPwdError", msg);
        } else {
          setPwdError("newPwdError", msg);
        }
      })
      .then(function () {
        pwdSubmitBtn.disabled = false;
        pwdSubmitBtn.textContent = "提交";
      });
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
