# 我的游戏小站

面向 GitHub Pages 的个人小游戏网站，提供五子棋、中国象棋、围棋、斗地主和谁是卧底。

## 当前状态

- 已完成：网站骨架、响应式游戏大厅、五子棋本地双人版、GitHub Pages 工作流和项目文档。
- 中国象棋：本地双人与邀请联机、红方先行、合法走法提示、吃子与应将检查、将死/困毙结算。联机支持双方确认和棋及刷新恢复；本地还支持悔棋和重开。
- 斗地主：本地对战两位电脑，或邀请朋友三人联机。支持改名、选座、观战、叫分、经典牌型、提示、春天、胜负结算及房主再开一局。手牌与未揭晓底牌由服务端隔离。
- 谁是卧底：4–8 人本地传递设备，或邀请朋友文字联机。支持秘密分词、轮流描述、私密投票、平票重投、淘汰揭晓与胜负结算；词语和未完成的投票只由服务端向本人提供。
- 围棋：9 路本地双人与邀请联机，支持提子、禁入点、全局同形禁止、停一手、整块死子标记、双方确认面积计分、恢复下棋、认输和房主重开。
- 已实现：Supabase 匿名身份、在线房间入口、邀请链接、服务端落子、实时订阅和重连恢复。
- 已发布：[游戏小站](https://yelindu.github.io/my-game-site/)。三款棋类游戏均先选择“本地对战”或“创建房间”，联机支持改名、选座和观战，双方入座后由房主开始。
- 已验证：Supabase 云端数据层、匿名登录、双客户端实时落子和胜负结算、本地网页刷新恢复、正式站点房间创建及双向落子同步。
- 待验收：发布后的两台实体设备对战。
- 暂不提供：棋类在线悔棋、五子棋和象棋同房间重开、账号注册、排行与聊天。

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
- [中国象棋玩法与规则范围](docs/xiangqi.md)
- [斗地主玩法与联机说明](docs/doudizhu.md)
- [谁是卧底玩法与联机说明](docs/undercover.md)
- [围棋玩法与规则范围](docs/go.md)

## 发布

1. 在 GitHub 创建空仓库并把本项目推送到 `main` 分支。
2. 打开仓库 `Settings > Pages`。
3. 将 `Build and deployment > Source` 设置为 `GitHub Actions`。
4. 后续每次推送到 `main`，工作流会自动构建并发布。

在线房间还需完成 [在线部署说明](docs/online-multiplayer.md)：初始化 Supabase、开启匿名登录，并设置 GitHub Actions 的 `VITE_SUPABASE_URL` 仓库变量和 `VITE_SUPABASE_ANON_KEY` 仓库 Secret。本地 `.env.local` 不会上传到 GitHub。
