# 内部导航系统

分类 → 网址列表的内部导航页，替代 OneNav。前台只读展示，后台可管理分类、网址，支持拖拽调整顺序，网址图标自动抓取网站 favicon。

## 安装

```bash
git clone https://github.com/lewsuy/nav-portal.git
cd nav-portal
sudo bash install.sh
```

也可以在 [Releases](https://github.com/lewsuy/nav-portal/releases) 页面下载打包好的 tar.gz，解压后同样执行 `sudo bash install.sh`。

安装脚本会：

- 部署程序到 `/opt/nav-portal`
- 创建 Python 虚拟环境并安装依赖
- 首次运行自动生成管理员账号（用户名 `admin`，随机密码，安装结束时会打印一次，也保存在 `/opt/nav-portal/data/initial_admin_password.txt`）
- 注册为 systemd 服务 `nav-portal`，监听 `9000` 端口，开机自启

## 升级

```bash
cd nav-portal
git pull
sudo bash install.sh
```

脚本会检测到已有数据库并跳过覆盖，只更新程序代码。

## 常用命令

```bash
sudo systemctl status nav-portal   # 查看运行状态
sudo systemctl restart nav-portal  # 重启
sudo journalctl -u nav-portal -f   # 查看日志
```

## 访问

- 前台：`http://<服务器IP>:9000/`
- 后台：`http://<服务器IP>:9000/admin`

## 数据备份

数据库文件在 `/opt/nav-portal/data/nav.db`，图标缓存在 `/opt/nav-portal/static/icons/`，备份这两处即可。
