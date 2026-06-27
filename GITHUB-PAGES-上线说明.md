# GitHub Pages 上线说明（v3.1）

## 方法一：网页上传（推荐新手）

1. 解压 `OPC_旗舰版v3.1_上线版.zip`
2. 登录 GitHub，进入你的仓库（或新建仓库）
3. 点击 `Add file → Upload files`
4. 将解压后的**所有文件**拖入上传区（包括 `.nojekyll`）
5. 填写 commit message，点击 `Commit changes`
6. 进入 `Settings → Pages`
7. 配置：
   - Source: **Deploy from a branch**
   - Branch: **main** → Folder: **/root**
   - 点击 **Save**
8. 等待 1-3 分钟，页面顶部会显示站点地址：
   `https://你的用户名.github.io/仓库名/`

## 方法二：Git 命令行

```bash
# 克隆仓库
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名

# 复制解压后的所有文件到仓库根目录
# （确保 index.html 在根目录，不要嵌套文件夹）

# 提交并推送
git add .
git commit -m "feat: OPC旗舰版 v3.1 全面UI优化上线"
git push origin main
```

## 方法三：GitHub CLI

```bash
# 认证（首次需要）
gh auth login

# 创建新仓库并推送
cd 解压后的文件夹
git init
git add .
git commit -m "feat: OPC旗舰版 v3.1"
gh repo create opc-camp --public --source=. --push
```

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| 404 错误 | 检查 `index.html` 是否在仓库**根目录**（不要嵌套文件夹） |
| 样式丢失 | 确认 `.nojekyll` 文件已上传（禁用 Jekyll 处理） |
| 图标不显示 | 确认 `assets/icons/` 目录完整上传 |
| PWA 不生效 | GitHub Pages 的 HTTPS 自动满足 PWA 要求，检查 `sw.js` 和 `manifest.webmanifest` 已上传 |
| 缓存旧版本 | Service Worker 会缓存旧资源，可在浏览器 DevTools → Application → Service Workers → Unregister |

## 演示卡密

- 用户登录：`OPC-VIEW-2026`
- 管理员登录：`OPC-EDIT-2026`

## 可选：接入云端后端

如需启用实时审核、状态轮询等云端功能：

1. 将 `cloudflare-worker.js` 部署到 Cloudflare Workers
2. 配置 KV 命名空间和 R2 存储桶（参考 `wrangler.toml.example`）
3. 修改 `cloud-config.js` 中的 `apiBase` 为 Worker 地址
4. 重新提交推送
