# OPC超级个体训练营｜UI 旗舰版 v3.1

## 版本亮点

**v3.1 全面视觉优化**（基于 v3 两版整合版）：

- Inter 字体 + 抗锯齿渲染优化
- Toast 通知系统（替代所有 alert）
- 移动端汉堡菜单（抽屉式侧边栏 + 遮罩）
- 卡片悬浮微动画（上浮 + 辉光 + 边框提亮）
- 视图切换淡入动画 + Modal 弹簧入场
- 按钮交互状态（光泽扫过 / 压缩回弹）
- 自定义渐变进度条（webkit/moz 双兼容）
- 无障碍增强（focus-visible + prefers-reduced-motion）
- WCAG AA 对比度修正（muted 色值提亮）
- 渐变标题文字效果

**v3 核心功能**（两版整合）：

- 多页面架构：首页 / 代理认证 / 素材库 / 学习进度 / 考核
- 云端协作：Cloudflare Worker 后端 API
- 实时状态轮询（15s）：用户端审核进度提示 / 管理端统计看板
- 管理端审核面板：Dialog 弹窗，通过 / 拒绝 / 删除
- 素材状态管理：pending / published / rejected
- PWA 支持：Service Worker 离线缓存 + 可安装

## 演示卡密

- 用户登录：`OPC-VIEW-2026`
- 管理员登录：`OPC-EDIT-2026`

## GitHub 上传要求

解压后，仓库根目录必须直接看到：

- `index.html`
- `styles.css`
- `app.js`
- `404.html`
- `.nojekyll`
- `README.md`

不要上传外层文件夹，不要只上传 ZIP。
