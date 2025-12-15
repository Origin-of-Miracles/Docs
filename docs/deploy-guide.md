# 部署配置指南

本文档介绍如何配置 GitHub Actions 以通过 SSH 自动部署文档网站到 WebServer。

## 📋 概述

该 GitHub Action 工作流程会在以下情况触发：
- 向 `main` 分支推送代码时
- 手动触发工作流时

工作流程将自动：
1. 构建 VitePress 文档站点
2. 通过 SSH 连接到您的服务器
3. 使用 rsync 同步构建产物到指定目录

## 🔐 SSH 密钥配置

### 1. 生成 SSH 密钥对

在本地终端执行以下命令生成专用的部署密钥：

```bash
# 生成 Ed25519 密钥（推荐，更安全）
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key

# 或者生成 RSA 密钥（兼容性更好）
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_deploy_key
```

> ⚠️ **注意**：生成密钥时**不要设置密码**（直接按回车），否则 GitHub Actions 无法使用。

### 2. 查看生成的密钥

```bash
# 查看私钥（需要添加到 GitHub Secrets）
cat ~/.ssh/github_deploy_key

# 查看公钥（需要添加到服务器）
cat ~/.ssh/github_deploy_key.pub
```

### 3. 将公钥添加到服务器

登录到您的 WebServer，将公钥添加到 `authorized_keys`：

```bash
# 登录服务器
ssh user@your-server.com

# 确保 .ssh 目录存在且权限正确
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# 将公钥添加到 authorized_keys
echo "你的公钥内容" >> ~/.ssh/authorized_keys

# 设置正确的权限
chmod 600 ~/.ssh/authorized_keys
```

或者使用 `ssh-copy-id` 一键完成：

```bash
ssh-copy-id -i ~/.ssh/github_deploy_key.pub user@your-server.com
```

### 4. 测试 SSH 连接

```bash
ssh -i ~/.ssh/github_deploy_key user@your-server.com
```

如果能成功登录，说明密钥配置正确。

## ⚙️ GitHub Secrets 配置

进入 GitHub 仓库页面：**Settings** → **Secrets and variables** → **Actions** → **New repository secret**

### 必需的 Secrets

| Secret 名称 | 说明 | 示例值 |
|------------|------|-------|
| `SSH_PRIVATE_KEY` | SSH 私钥内容（完整内容，包括 BEGIN 和 END 行） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `SERVER_HOST` | 服务器 IP 地址或域名 | `192.168.1.100` 或 `your-server.com` |
| `SERVER_USER` | SSH 登录用户名 | `deploy` 或 `www-data` |
| `SERVER_PATH` | 部署目标路径（服务器上的绝对路径） | `/var/www/docs` 或 `/home/user/public_html` |

### 可选的 Secrets

| Secret 名称 | 说明 | 默认值 |
|------------|------|-------|
| `SERVER_PORT` | SSH 端口号 | `22` |

### 添加 Secrets 的步骤

1. 打开您的 GitHub 仓库
2. 点击 **Settings**（设置）
3. 在左侧菜单找到 **Secrets and variables** → **Actions**
4. 点击 **New repository secret**
5. 逐一添加上述 Secrets

#### 添加 SSH 私钥示例

![添加 Secret](https://docs.github.com/assets/images/help/repository/repo-secret-add.png)

1. **Name**: `SSH_PRIVATE_KEY`
2. **Secret**: 粘贴完整的私钥内容，包括：
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAA...
   ...完整的密钥内容...
   -----END OPENSSH PRIVATE KEY-----
   ```

## 🖥️ 服务器端配置

### 1. 创建部署目录

```bash
# 创建网站目录
sudo mkdir -p /var/www/docs

# 设置所有者（替换为您的部署用户）
sudo chown -R deploy:deploy /var/www/docs

# 设置权限
sudo chmod -R 755 /var/www/docs
```

### 2. 安装 rsync（如果未安装）

```bash
# Debian/Ubuntu
sudo apt-get update && sudo apt-get install -y rsync

# CentOS/RHEL
sudo yum install -y rsync

# macOS (通常已预装)
brew install rsync
```

### 3. 配置 Web 服务器

#### Nginx 配置示例

```nginx
server {
    listen 80;
    server_name docs.example.com;
    root /var/www/docs;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 缓存静态资源
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Apache 配置示例

```apache
<VirtualHost *:80>
    ServerName docs.example.com
    DocumentRoot /var/www/docs

    <Directory /var/www/docs>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # 启用 URL 重写
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</VirtualHost>
```

## 🚀 手动触发部署

除了推送代码自动触发外，您也可以手动触发部署：

1. 进入仓库的 **Actions** 页面
2. 选择 **Deploy Docs to WebServer** 工作流
3. 点击 **Run workflow**
4. 选择分支后点击 **Run workflow** 按钮

## 🔍 故障排除

### 常见问题

#### 1. SSH 连接失败

```
Permission denied (publickey)
```

**解决方案**：
- 确认公钥已正确添加到服务器的 `~/.ssh/authorized_keys`
- 检查服务器的 SSH 配置是否允许密钥认证
- 确认 `~/.ssh` 目录权限为 700，`authorized_keys` 权限为 600

#### 2. Host key verification failed

```
Host key verification failed
```

**解决方案**：
- 确认 `SERVER_HOST` Secret 配置正确
- 检查服务器 SSH 服务是否正常运行

#### 3. rsync 失败

```
rsync: connection unexpectedly closed
```

**解决方案**：
- 确认服务器已安装 rsync
- 检查部署路径是否存在且有写入权限
- 确认 SSH 端口配置正确

#### 4. 构建失败

```
Command failed with exit code 1
```

**解决方案**：
- 检查 `pnpm-lock.yaml` 是否已提交
- 确认 Node.js 版本兼容性
- 本地运行 `pnpm install && pnpm docs:build` 测试

### 查看部署日志

1. 进入仓库的 **Actions** 页面
2. 点击对应的工作流运行记录
3. 展开各个步骤查看详细日志

## 📝 安全建议

1. **使用专用部署密钥**：不要复用其他用途的 SSH 密钥
2. **限制密钥权限**：在服务器上可以限制该密钥只能执行特定命令
3. **定期轮换密钥**：建议每 6-12 个月更换一次部署密钥
4. **最小权限原则**：部署用户应只拥有必要的目录写入权限
5. **启用防火墙**：只允许必要的端口访问

### 限制 SSH 密钥权限（可选）

在服务器的 `~/.ssh/authorized_keys` 中，可以在公钥前添加限制：

```
command="rsync --server -vlogDtprze.iLsf --delete . /var/www/docs",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA... github-actions-deploy
```

这将限制该密钥只能用于 rsync 同步到指定目录。

---

## 📚 参考链接

- [GitHub Actions 文档](https://docs.github.com/cn/actions)
- [VitePress 部署指南](https://vitepress.dev/guide/deploy)
- [SSH 密钥生成](https://docs.github.com/cn/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent)
- [webfactory/ssh-agent Action](https://github.com/webfactory/ssh-agent)
