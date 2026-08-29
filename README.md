# 我的游戏小站

面向 GitHub Pages 的个人联机小游戏网站。第一款游戏计划为五子棋，随后扩展中国象棋。

## 当前状态

- 已完成：网站骨架、响应式游戏大厅、五子棋本地双人版、GitHub Pages 工作流和项目文档。
- 下一步：发布到 GitHub Pages，然后接入在线房间。
- 暂未接入：Supabase、在线房间、账号、排行与聊天。

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
