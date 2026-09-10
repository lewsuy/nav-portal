#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/nav-portal"
SERVICE_NAME="nav-portal"
PORT=80
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "== 内部导航系统 安装脚本 =="

if [[ $EUID -ne 0 ]]; then
  echo "请用 root 权限运行（sudo bash install.sh）" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "未找到 python3，请先安装 python3" >&2
  exit 1
fi

if ! python3 -c "import ensurepip" >/dev/null 2>&1; then
  echo "未找到 python3 venv 模块，尝试安装 python3-venv..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y && apt-get install -y python3-venv
  elif command -v yum >/dev/null 2>&1; then
    yum install -y python3-venv || true
  fi
fi

FRESH_INSTALL=1
if [[ -f "$INSTALL_DIR/data/nav.db" ]]; then
  FRESH_INSTALL=0
  echo "检测到已有数据库（$INSTALL_DIR/data/nav.db），本次安装只更新程序代码，不会覆盖已有分类/网址数据。"
fi

echo "-- 停止已有服务（如果存在）--"
systemctl stop "$SERVICE_NAME" 2>/dev/null || true

echo "-- 部署程序文件到 $INSTALL_DIR --"
mkdir -p "$INSTALL_DIR"

# 图标缓存（static/icons）和 data 一样属于"运行时数据"，同步时必须保留。
# 先备份到临时目录，同步完成后再恢复，避免被 --delete / rm -rf 清掉。
ICON_BACKUP=""
if [[ -d "$INSTALL_DIR/static/icons" ]]; then
  ICON_BACKUP="$(mktemp -d)"
  cp -a "$INSTALL_DIR/static/icons/." "$ICON_BACKUP/" 2>/dev/null || true
fi

# 保留 data 目录（数据库 + 已抓取的图标缓存），只替换程序代码
rsync -a --delete \
  --exclude 'data' \
  --exclude 'venv' \
  --exclude 'static/icons' \
  "$SCRIPT_DIR"/ "$INSTALL_DIR"/ 2>/dev/null || {
    # 没有 rsync 时的兜底方案：只清理顶层条目，跳过 data / venv
    find "$INSTALL_DIR" -mindepth 1 -maxdepth 1 \
      ! -name data ! -name venv -exec rm -rf {} + 2>/dev/null || true
    cp -r "$SCRIPT_DIR"/. "$INSTALL_DIR"/
  }

mkdir -p "$INSTALL_DIR/data" "$INSTALL_DIR/static/icons"

# 恢复图标缓存
if [[ -n "$ICON_BACKUP" ]]; then
  cp -a "$ICON_BACKUP/." "$INSTALL_DIR/static/icons/" 2>/dev/null || true
  rm -rf "$ICON_BACKUP"
fi
# 保证 .gitkeep 存在（static/icons 被清空时占位）
: > "$INSTALL_DIR/static/icons/.gitkeep"

echo "-- 创建 Python 虚拟环境并安装依赖 --"
if [[ ! -d "$INSTALL_DIR/venv" ]]; then
  python3 -m venv "$INSTALL_DIR/venv"
fi
"$INSTALL_DIR/venv/bin/pip" install --quiet --upgrade pip
"$INSTALL_DIR/venv/bin/pip" install --quiet -r "$INSTALL_DIR/requirements.txt"

echo "-- 初始化数据库（首次运行会自动生成管理员账号）--"
NAV_DB_PATH="$INSTALL_DIR/data/nav.db" "$INSTALL_DIR/venv/bin/python" -c "import db; db.init_db()"

# 固定 Flask session 密钥，避免每次重启服务后所有人被强制登出
if [[ ! -f "$INSTALL_DIR/data/secret_key" ]]; then
  python3 -c "import secrets; print(secrets.token_hex(32))" > "$INSTALL_DIR/data/secret_key"
  chmod 600 "$INSTALL_DIR/data/secret_key"
fi
NAV_SECRET_KEY="$(cat "$INSTALL_DIR/data/secret_key")"

# 可选配置：站点名称与项目地址（不设置则使用程序内置默认值）
# 用法：sudo NAV_SITE_NAME="运维导航" NAV_PROJECT_URL="https://example.com" bash install.sh
ENV_EXTRA=""
if [[ -n "${NAV_SITE_NAME:-}" ]]; then
  ENV_EXTRA="${ENV_EXTRA}Environment=NAV_SITE_NAME=${NAV_SITE_NAME}
"
fi
if [[ -n "${NAV_PROJECT_URL:-}" ]]; then
  ENV_EXTRA="${ENV_EXTRA}Environment=NAV_PROJECT_URL=${NAV_PROJECT_URL}
"
fi

echo "-- 写入 systemd 服务 --"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=Internal Nav Portal
After=network.target

[Service]
Type=simple
WorkingDirectory=${INSTALL_DIR}
Environment=NAV_DB_PATH=${INSTALL_DIR}/data/nav.db
Environment=NAV_SECRET_KEY=${NAV_SECRET_KEY}
${ENV_EXTRA}ExecStart=${INSTALL_DIR}/venv/bin/gunicorn -w 2 -b 0.0.0.0:${PORT} app:app
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

sleep 1
echo ""
echo "== 安装完成 =="
systemctl --no-pager status "$SERVICE_NAME" | head -5
echo ""
IP_HINT="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo "前台访问：http://${IP_HINT:-<本机IP>}:${PORT}/"
echo "后台管理：http://${IP_HINT:-<本机IP>}:${PORT}/admin"

if [[ "$FRESH_INSTALL" -eq 1 ]] && [[ -f "$INSTALL_DIR/data/initial_admin_password.txt" ]]; then
  echo ""
  echo "首次安装，管理员账号信息如下（也保存在 ${INSTALL_DIR}/data/initial_admin_password.txt）："
  echo "-----------------------------------------------"
  cat "$INSTALL_DIR/data/initial_admin_password.txt"
  echo "-----------------------------------------------"
  echo "登录后台后请尽快修改密码。"
fi
