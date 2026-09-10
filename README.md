# 内部导航系统 nav-portal

一个轻量的内部网址导航站：前台按「分类 → 网址」只读展示，后台可视化增删改、拖拽排序，网址图标自动抓取，也支持手动上传。单机部署，一条命令搞定。

## 功能特性

**前台**

- 分类分组展示，点卡片直达目标站点
- 卡片悬停变色，`title` 提示完整网址
- 「私有分类」仅登录后可见，未登录自动隐藏
- 响应式布局：宽屏一行 6 个，中屏 4 个，平板 3 个，手机 2 个
- 明 / 暗主题切换，跟随系统或手动指定
- 纯服务端渲染，首屏无白屏，无前端框架依赖

**后台**

- 分类 / 网址增删改查，支持拖拽调整分类与网址顺序、跨分类移动
- 网址图标自动抓取 favicon；抓不到时可手动粘贴图标链接或本地上传（自动转存到服务器）
- 分类支持「私有」开关，控制前台是否公开
- 修改管理员密码（原密码校验 + 前端即时错误提示）
- 侧边栏导航、主题切换、项目仓库入口

## 技术栈

| 层次 | 技术 | 说明 |
| --- | --- | --- |
| 后端框架 | Python 3 + Flask 3 | 路由、模板渲染、Session 登录态 |
| 生产服务器 | Gunicorn | 2 worker 多进程，systemd 托管 |
| 数据库 | SQLite 3 | 零配置单文件，`data/nav.db` |
| 模板引擎 | Jinja2 | 服务端渲染 HTML |
| 前端 | 原生 HTML / CSS / JavaScript（ES5 兼容） | 无框架、无构建步骤 |
| 图标抓取 | requests + BeautifulSoup4 | 解析 `<link rel="icon">`，失败回退 `/favicon.ico` |
| 密码安全 | Werkzeug Security | `pbkdf2:sha256` 哈希存储 |
| 进程守护 | systemd | 崩溃自动重启、开机自启 |
| 部署 | Bash 安装脚本 + rsync | 幂等部署，保留数据与图标缓存 |

## 目录结构

```
nav-portal/
├── app.py              # Flask 应用：前台 / 后台 / REST API 路由
├── db.py               # SQLite 初始化与幂等迁移、密码初始化
├── favicon.py          # 图标抓取、下载、本地保存
├── install.sh          # 一键部署脚本（venv + systemd）
├── requirements.txt    # Python 依赖
├── templates/          # Jinja2 模板：index / admin / 登录等
└── static/
    ├── css/            # style.css（前台）、admin.css（后台）
    ├── js/             # theme.js（主题）、admin.js（后台交互）
    └── icons/          # 抓取或上传的图标缓存（运行时数据）
```

## 快速开始

```bash
git clone https://github.com/lewsuy/nav-portal.git
cd nav-portal
sudo bash install.sh
```

也可以在 [Releases](https://github.com/lewsuy/nav-portal/releases) 下载打包好的 tar.gz，解压后执行同样的命令。

安装脚本会：

- 部署程序到 `/opt/nav-portal`
- 创建 Python 虚拟环境并安装 `requirements.txt` 依赖
- 初始化数据库；首次安装自动生成管理员账号（用户名 `admin`，随机密码，安装结束时打印一次，并保存在 `/opt/nav-portal/data/initial_admin_password.txt`）
- 生成固定的 Session 密钥（`data/secret_key`），避免重启后所有人被强制登出
- 注册 systemd 服务 `nav-portal`，监听 **80** 端口，开机自启

首次登录请立即修改管理员密码。

## 升级

```bash
cd nav-portal
git pull
sudo bash install.sh
```

脚本是幂等的：检测到已有数据库时只更新程序代码，不会覆盖分类 / 网址数据；`data/`（数据库、密钥）和 `static/icons/`（图标缓存）在同步时会先备份再恢复。

## 本地开发

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py     # http://127.0.0.1:80
```

数据库路径、密钥、站点名称均可通过环境变量覆盖：

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NAV_DB_PATH` | `<项目>/data/nav.db` | SQLite 数据库文件路径 |
| `NAV_SECRET_KEY` | 随机生成 | Flask Session 密钥，固定后重启不会掉登录态 |
| `NAV_SITE_NAME` | `内部网址导航` | 站点名称：浏览器标题与顶部横条文案 |
| `NAV_PROJECT_URL` | 项目仓库地址 | 后台侧边栏「项目地址」按钮指向的链接 |

部署时也可以直接传入（不传则使用默认值）：

```bash
sudo NAV_SITE_NAME="运维导航" NAV_PROJECT_URL="https://example.com" bash install.sh
```

## 常用命令

```bash
sudo systemctl status nav-portal   # 查看运行状态
sudo systemctl restart nav-portal  # 重启服务
sudo systemctl stop nav-portal     # 停止服务
sudo journalctl -u nav-portal -f   # 实时查看日志
```

## 访问入口

- 前台：`http://<服务器IP>/`
- 后台：`http://<服务器IP>/admin`

## 端口修改

默认端口为 80。如需更换，修改 `install.sh` 顶部的 `PORT` 变量后重新执行 `sudo bash install.sh` 即可，systemd 服务会自动更新。

## 数据与备份

| 路径 | 内容 |
| --- | --- |
| `/opt/nav-portal/data/nav.db` | 数据库：分类、网址、管理员密码 |
| `/opt/nav-portal/data/secret_key` | Session 密钥 |
| `/opt/nav-portal/static/icons/` | 图标缓存 |

备份以上内容即可完整还原站点。

## 常见问题

**忘记管理员密码？**
密码是哈希存储、无法反查。可在服务器上用项目自带的环境直接覆盖哈希：

```bash
cd /opt/nav-portal
venv/bin/python -c "
import sqlite3, os
from werkzeug.security import generate_password_hash
from db import DB_PATH
conn = sqlite3.connect(DB_PATH)
conn.execute('UPDATE admin SET password_hash=? WHERE id=1', (generate_password_hash('新密码'),))
conn.commit()
"
```

**网址图标显示不出来？**
部分站点（如部署了 WAF 的面板）会拦截服务端抓取，或页面声明的图标地址本身就是 404。这类站点请在后台编辑该网址，用「上传图标」或「图标链接」手动指定。

**升级后图标丢失？**
说明 `install.sh` 里的图标备份恢复逻辑未生效。请确认脚本中包含 `ICON_BACKUP` 相关处理，并保证 `/opt/nav-portal/static/icons` 目录存在。

## 定制

| 想改什么 | 怎么改 |
| --- | --- |
| 站点名称 | 环境变量 `NAV_SITE_NAME`，或直接改 `app.py` 里的默认值 |
| 项目地址按钮 | 环境变量 `NAV_PROJECT_URL` |
| 监听端口 | `install.sh` 顶部 `PORT` 变量（默认 80） |
| 每行卡片数量 | `static/css/style.css` 中 `.card` 宽度公式与媒体查询 |
| 主题色 | `static/css/style.css` 顶部 `:root` 的 CSS 变量 |

## 开源说明

本仓库**只包含程序代码，不包含任何使用者的数据**：

- 导航数据（分类、网址、图标）全部存放在运行时生成的 `data/nav.db` 与 `static/icons/`，两者均已在 `.gitignore` 中排除，不会进入版本库
- 管理员账号在首次启动时随机生成，代码中没有任何内置账号或密码
- 代码中不含任何内网地址、域名、密钥；所有可变项都通过环境变量配置

因此克隆本仓库部署得到的是一个**空白系统**：首次安装后只有一个随机密码的 `admin` 账号，分类与网址需要自行在后台添加。

## License

[MIT](LICENSE)
