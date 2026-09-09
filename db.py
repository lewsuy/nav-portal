import os
import sqlite3
import secrets
import string
from werkzeug.security import generate_password_hash

DB_PATH = os.environ.get("NAV_DB_PATH", os.path.join(os.path.dirname(__file__), "data", "nav.db"))


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def init_db():
    """Create tables if they don't exist yet, and seed a default admin
    account on first run only. Safe to call every startup — never touches
    existing data."""
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS admin (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            username TEXT NOT NULL,
            password_hash TEXT NOT NULL
        );
        """
    )
    conn.commit()

    # Multiple gunicorn workers import this module at the same time, so this
    # must be safe under concurrent execution: INSERT OR IGNORE means only
    # one process's insert actually lands (rowcount == 1 for the winner,
    # 0 for everyone else), rather than everyone racing on a plain INSERT
    # and crashing with a UNIQUE constraint error.
    generated_password = None
    alphabet = string.ascii_letters + string.digits
    candidate_password = "".join(secrets.choice(alphabet) for _ in range(14))
    cur = conn.execute(
        "INSERT OR IGNORE INTO admin (id, username, password_hash) VALUES (1, ?, ?)",
        ("admin", generate_password_hash(candidate_password)),
    )
    conn.commit()

    if cur.rowcount == 1:
        generated_password = candidate_password
        # Write the one-time plaintext password to a root-only file, in
        # case it scrolls past in the install log.
        secret_path = os.path.join(os.path.dirname(DB_PATH), "initial_admin_password.txt")
        with open(secret_path, "w") as f:
            f.write(
                "首次启动自动生成的管理员账号：\n"
                "用户名: admin\n"
                f"密码: {generated_password}\n"
                "登录后请到后台自行修改密码；此文件之后可以删除。\n"
            )
        os.chmod(secret_path, 0o600)

    conn.close()
    return generated_password
