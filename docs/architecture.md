# 总体架构

## 目标

第一版先提供一个可发布、可扩展的个人游戏大厅，并完成五子棋的本地玩法。在线房间放在下一小步接入，避免首轮同时调试游戏规则和网络同步。

## 技术选择

| 层级 | 第一版 | 在线阶段 |
| --- | --- | --- |
| 页面与交互 | React + Vite | 保持不变 |
| 样式 | 原生 CSS | 保持不变 |
| 游戏状态 | React 本地状态 | 本地状态 + 房间同步 |
| 托管 | GitHub Pages | GitHub Pages |
| 账号与数据 | 不接入 | Supabase Auth + Postgres |
| 实时消息 | 不接入 | Supabase Realtime |

现在不加入路由库、全局状态库或组件库。出现第二个独立页面或跨功能共享状态后再评估。

## 目录

```text
.
├─ .github/workflows/deploy.yml  # GitHub Pages 自动发布
├─ docs/                         # 决策与开发文档
├─ src/
│  ├─ App.jsx                    # 当前单页入口与主要布局
│  ├─ gameCatalog.js             # 游戏大厅数据
│  ├─ main.jsx                   # React 挂载入口
│  └─ styles.css                 # 全局视觉与响应式样式
├─ .env.example                  # 在线阶段的公开环境变量示例
├─ index.html
├─ package.json
└─ vite.config.js
```

开始写五子棋时，再新增：

```text
src/games/gomoku/
├─ GomokuGame.jsx       # 棋盘界面与对局交互
├─ gomoku.js            # 纯函数：落子、胜负判断、重开
└─ gomoku.test.js       # 规则的最小单元测试
```

在线客户端位于 `src/services/supabase.js`。五子棋与象棋共用 `src/services/useOnlineRoom.js` 的同步、重连与提交逻辑，以及 `src/components/GameHub.jsx` 的玩法入口、`RoomLobby.jsx` 的选座等候区、`useRoomEntry.jsx` 的进入与邀请逻辑；各游戏提供接口名称、参数及快照解码。

中国象棋位于 `src/games/xiangqi/`：`OnlineXiangqi.jsx` 负责在线走棋和和棋协商；`XiangqiGame.jsx` 复用本地与在线棋盘。`pieces.js` 通过走棋历史保持棋子身份，棋子图层使用原生 CSS 位置过渡。五子棋同样复用本地与在线棋盘，并使用 CSS 落子动画，不引入动画或棋类依赖。

## 状态边界

1. 棋盘规则是纯 JavaScript，不依赖 React 和网络，方便测试与复用。
2. React 组件负责展示、输入和页面状态。
3. 客户端在线服务负责身份、房间、提交和订阅，收到原子快照后校验并显示棋盘，不提前修改棋盘。
4. 数据库函数锁住房间并校验轮次、合法走法与胜负；象棋额外校验客户端看到的走棋版本，拒绝重复或过期提交。
5. 象棋独立使用 `xiangqi_rooms`、`xiangqi_moves`，沿用游客身份，不改动五子棋数据。数据库规则与 JavaScript 规则通过完整合法走法对照测试保持一致。

## GitHub Pages 约束

GitHub Pages 只提供静态文件，不能运行长期 WebSocket 服务或私密服务端代码。因此前端部署在 GitHub Pages，在线数据和实时连接交给 Supabase。Vite 使用相对资源路径，可以部署在用户主页或项目子路径。

## 安全边界

- 浏览器只使用 Supabase URL 和匿名公钥。
- `service_role` 密钥绝不进入 `.env`、浏览器代码或 GitHub 仓库。
- 数据表启用 RLS，玩家只能操作自己参与的房间和合法落子。
- 最终落子校验放在数据库函数中，不能只相信浏览器。

