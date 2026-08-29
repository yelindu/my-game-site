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

在线房间落地时，再新增 `src/services/supabase.js` 和 `src/features/rooms/`。不提前创建空文件夹。

## 状态边界

1. 棋盘规则是纯 JavaScript，不依赖 React 和网络，方便测试与复用。
2. React 组件负责展示、输入和页面状态。
3. 在线服务只负责身份、房间、落子提交和订阅，不复制游戏规则。
4. 数据库函数负责原子校验“轮到谁、格子是否为空、对局是否结束”，避免两位玩家同时落子造成冲突。

## GitHub Pages 约束

GitHub Pages 只提供静态文件，不能运行长期 WebSocket 服务或私密服务端代码。因此前端部署在 GitHub Pages，在线数据和实时连接交给 Supabase。Vite 使用相对资源路径，可以部署在用户主页或项目子路径。

## 安全边界

- 浏览器只使用 Supabase URL 和匿名公钥。
- `service_role` 密钥绝不进入 `.env`、浏览器代码或 GitHub 仓库。
- 数据表启用 RLS，玩家只能操作自己参与的房间和合法落子。
- 最终落子校验放在数据库函数中，不能只相信浏览器。

