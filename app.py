import os
from functools import wraps

from flask import Flask, render_template, request, redirect, url_for, session, jsonify
from werkzeug.security import check_password_hash, generate_password_hash

import db
from favicon import fetch_favicon, download_icon, save_icon_bytes, ICON_DIR

app = Flask(__name__)
app.secret_key = os.environ.get("NAV_SECRET_KEY") or os.urandom(32)

AVATAR_COLORS = ["#6366f1", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f472b6", "#10b981"]


def avatar_style(name):
    char = (name or "?").strip()[:1] or "?"
    color = AVATAR_COLORS[sum(ord(c) for c in name) % len(AVATAR_COLORS)] if name else AVATAR_COLORS[0]
    return char, color


def login_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not session.get("logged_in"):
            if request.path.startswith("/admin/api/"):
                return jsonify({"error": "未登录"}), 401
            return redirect(url_for("admin_login"))
        return view(*args, **kwargs)
    return wrapped


def get_nav_data(include_private=False):
    conn = db.get_db()
    categories = conn.execute(
        "SELECT * FROM categories ORDER BY sort_order, id"
    ).fetchall()
    result = []
    for cat in categories:
        if not include_private and cat["is_private"]:
            continue
        links = conn.execute(
            "SELECT * FROM links WHERE category_id = ? ORDER BY sort_order, id",
            (cat["id"],),
        ).fetchall()
        link_dicts = []
        for l in links:
            d = dict(l)
            if not d["icon"]:
                char, color = avatar_style(d["name"])
                d["avatar_char"] = char
                d["avatar_color"] = color
            link_dicts.append(d)
        result.append({"category": dict(cat), "links": link_dicts})
    conn.close()
    return result


# ---------- 前台 ----------

@app.route("/")
def index():
    # 未登录时过滤私有分类；登录后（session 中）展示全部
    logged_in = bool(session.get("logged_in"))
    return render_template("index.html", groups=get_nav_data(include_private=logged_in))


# ---------- 后台登录 ----------

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    error = None
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        conn = db.get_db()
        row = conn.execute("SELECT * FROM admin WHERE id = 1").fetchone()
        conn.close()
        if row and username == row["username"] and check_password_hash(row["password_hash"], password):
            session["logged_in"] = True
            return redirect(url_for("admin_dashboard"))
        error = "用户名或密码错误"
    return render_template("admin_login.html", error=error)


@app.route("/admin/logout")
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))


@app.route("/admin/change-password", methods=["POST"])
@login_required
def admin_change_password():
    # 支持 AJAX(JSON) 与表单两种提交方式
    if request.is_json:
        data = request.json or {}
        old_password = data.get("old_password", "")
        new_password = data.get("new_password", "")
        confirm_password = data.get("confirm_password", "")

        def fail(msg):
            return jsonify({"error": msg}), 400

        success_redirect = None
    else:
        data = request.form
        old_password = data.get("old_password", "")
        new_password = data.get("new_password", "")
        confirm_password = data.get("confirm_password", "")

        def fail(msg):
            return redirect(url_for("admin_dashboard", pwd_error=msg))

        success_redirect = redirect(url_for("admin_dashboard", pwd_ok="密码修改成功"))

    if len(new_password) < 6:
        return fail("密码至少6位")
    if new_password != confirm_password:
        return fail("两次输入不一致")

    conn = db.get_db()
    row = conn.execute("SELECT * FROM admin WHERE id = 1").fetchone()
    if not row or not check_password_hash(row["password_hash"], old_password):
        conn.close()
        return fail("旧密码错误")
    conn.execute(
        "UPDATE admin SET password_hash = ? WHERE id = 1",
        (generate_password_hash(new_password),),
    )
    conn.commit()
    conn.close()
    return success_redirect or jsonify({"ok": True})


# ---------- 后台面板 ----------

@app.route("/admin")
@login_required
def admin_dashboard():
    # 后台始终展示全部分类（含私有），否则无法管理私有分类下的网址
    return render_template("admin.html", groups=get_nav_data(include_private=True))


# ---------- 分类 API ----------

@app.route("/admin/api/categories", methods=["POST"])
@login_required
def create_category():
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "分类名称不能为空"}), 400
    is_private = 1 if data.get("is_private") else 0
    conn = db.get_db()
    max_order = conn.execute("SELECT COALESCE(MAX(sort_order), -1) AS m FROM categories").fetchone()["m"]
    cur = conn.execute(
        "INSERT INTO categories (name, sort_order, is_private) VALUES (?, ?, ?)",
        (name, max_order + 1, is_private),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({"id": new_id, "name": name, "is_private": is_private})


@app.route("/admin/api/categories/<int:cat_id>", methods=["PUT"])
@login_required
def update_category(cat_id):
    data = request.json or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "分类名称不能为空"}), 400
    is_private = 1 if data.get("is_private") else 0
    conn = db.get_db()
    conn.execute(
        "UPDATE categories SET name = ?, is_private = ? WHERE id = ?",
        (name, is_private, cat_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/admin/api/categories/<int:cat_id>", methods=["DELETE"])
@login_required
def delete_category(cat_id):
    conn = db.get_db()
    conn.execute("DELETE FROM categories WHERE id = ?", (cat_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/admin/api/categories/reorder", methods=["POST"])
@login_required
def reorder_categories():
    order = (request.json or {}).get("order", [])
    conn = db.get_db()
    for idx, cat_id in enumerate(order):
        conn.execute("UPDATE categories SET sort_order = ? WHERE id = ?", (idx, cat_id))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ---------- 网址 API ----------

def _link_payload():
    """支持 JSON 与 multipart 两种提交方式，返回 (fields, icon_file)。"""
    if (request.content_type or "").startswith("multipart/"):
        return request.form.to_dict(), request.files.get("icon_file")
    return (request.json or {}), None


def _truthy(v):
    return str(v or "").strip().lower() in ("1", "true", "yes", "on")


def _existing_icon_path(path):
    """校验 icons/ 下的相对路径确实存在，防止路径穿越；合法返回规范化路径。"""
    if not path:
        return None
    safe = os.path.normpath(path.strip()).replace("\\", "/")
    if not safe.startswith("icons/") or ".." in safe.split("/"):
        return None
    if os.path.isfile(os.path.join(ICON_DIR, safe[len("icons/"):])):
        return safe
    return None


def _resolve_icon(icon_file, icon_url, url, icon_path=None, icon_remove=False):
    """图标优先级：上传文件 > 已上传路径 > 图标地址 > 删除 > 自动抓取。失败返回 (icon, error)。"""
    if icon_file and icon_file.filename:
        icon = save_icon_bytes(icon_file.read(), icon_file.filename)
        if not icon:
            return None, "图标文件保存失败"
        return icon, None
    if icon_path:
        existing = _existing_icon_path(icon_path)
        if not existing:
            return None, "图标路径不存在"
        return existing, None
    if icon_url:
        if icon_url.strip().startswith("icons/"):
            existing = _existing_icon_path(icon_url)
            if not existing:
                return None, "图标路径不存在"
            return existing, None
        icon = download_icon(icon_url)
        if not icon:
            return None, "图标地址下载失败，请确认地址可访问"
        return icon, None
    if icon_remove:
        return None, None
    return fetch_favicon(url), None


@app.route("/admin/api/upload-icon", methods=["POST"])
@login_required
def upload_icon():
    f = request.files.get("icon_file")
    if not f or not f.filename:
        return jsonify({"error": "未选择文件"}), 400
    icon = save_icon_bytes(f.read(), f.filename)
    if not icon:
        return jsonify({"error": "图标文件保存失败"}), 400
    return jsonify({"icon": icon})


@app.route("/admin/api/links", methods=["POST"])
@login_required
def create_link():
    fields, icon_file = _link_payload()
    name = (fields.get("name") or "").strip()
    url = (fields.get("url") or "").strip()
    icon_url = (fields.get("icon_url") or "").strip()
    icon_path = (fields.get("icon_path") or "").strip()
    try:
        category_id = int(fields.get("category_id"))
    except (TypeError, ValueError):
        category_id = None
    if not (name and url and category_id):
        return jsonify({"error": "名称、网址、分类不能为空"}), 400

    icon, err = _resolve_icon(icon_file, icon_url, url, icon_path=icon_path,
                              icon_remove=_truthy(fields.get("icon_remove")))
    if err:
        return jsonify({"error": err}), 400

    conn = db.get_db()
    max_order = conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) AS m FROM links WHERE category_id = ?",
        (category_id,),
    ).fetchone()["m"]
    cur = conn.execute(
        "INSERT INTO links (category_id, name, url, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
        (category_id, name, url, icon, max_order + 1),
    )
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return jsonify({"id": new_id, "name": name, "url": url, "icon": icon, "category_id": category_id})


@app.route("/admin/api/links/<int:link_id>", methods=["PUT"])
@login_required
def update_link(link_id):
    fields, icon_file = _link_payload()
    name = (fields.get("name") or "").strip()
    url = (fields.get("url") or "").strip()
    icon_url = (fields.get("icon_url") or "").strip()
    icon_path = (fields.get("icon_path") or "").strip()
    if not (name and url):
        return jsonify({"error": "名称、网址不能为空"}), 400

    conn = db.get_db()
    old = conn.execute("SELECT * FROM links WHERE id = ?", (link_id,)).fetchone()
    if not old:
        conn.close()
        return jsonify({"error": "网址不存在"}), 404
    if icon_file and icon_file.filename or icon_url or icon_path or _truthy(fields.get("icon_remove")):
        icon, err = _resolve_icon(icon_file, icon_url, url, icon_path=icon_path,
                                  icon_remove=_truthy(fields.get("icon_remove")))
        if err:
            conn.close()
            return jsonify({"error": err}), 400
    elif old["url"] != url:
        icon = fetch_favicon(url)
    else:
        icon = old["icon"]
    conn.execute(
        "UPDATE links SET name = ?, url = ?, icon = ? WHERE id = ?",
        (name, url, icon, link_id),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "icon": icon})


@app.route("/admin/api/links/<int:link_id>", methods=["DELETE"])
@login_required
def delete_link(link_id):
    conn = db.get_db()
    conn.execute("DELETE FROM links WHERE id = ?", (link_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/admin/api/links/reorder", methods=["POST"])
@login_required
def reorder_links():
    data = request.json or {}
    category_id = data.get("category_id")
    order = data.get("order", [])
    conn = db.get_db()
    for idx, link_id in enumerate(order):
        conn.execute(
            "UPDATE links SET sort_order = ?, category_id = ? WHERE id = ?",
            (idx, category_id, link_id),
        )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


db.init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, debug=True)
