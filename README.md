# 我的游戏小站

面向 GitHub Pages 的个人联机小游戏网站。第一款游戏计划为五子棋，随后扩展中国象棋。

## 当前状态

- 已完成：网站骨架、响应式游戏大厅、五子棋本地双人版、GitHub Pages 工作流和项目文档。
- 已实现：Supabase 匿名身份、在线房间入口、邀请链接、服务端落子、实时订阅和重连恢复。
- 已验证：Supabase 云端数据层、匿名登录、双客户端实时落子和胜负结算、网页刷新恢复；GitHub Actions 联机变量已配置。
- 待验收：发布后的两台实体设备对战。
- 暂不提供：在线悔棋、同房间重开、账号注册、排行与聊天。

## 本地启动

需要 Node.js 22 或更新的长期支持版本。

```bash
npm install
npm run dev
```

规则测试：

```bash
npm test
```

生产构建：

```bash
npm run build
npm run preview
```

## 文档

- [总体架构](docs/architecture.md)
- [开发指南](docs/development.md)
- [在线联机方案](docs/online-multiplayer.md)
- [版本路线](docs/roadmap.md)

## 发布

1. 在 GitHub 创建空仓库并把本项目推送到 `main` 分支。
2. 打开仓库 `Settings > Pages`。
3. 将 `Build and deployment > Source` 设置为 `GitHub Actions`。
4. 后续每次推送到 `main`，工作流会自动构建并发布。

在线房间还需完成 [在线部署说明](docs/online-multiplayer.md)：初始化 Supabase、开启匿名登录，并设置 GitHub Actions 的 `VITE_SUPABASE_URL` 仓库变量和 `VITE_SUPABASE_ANON_KEY` 仓库 Secret。本地 `.env.local` 不会上传到 GitHub。
