# 在线联机方案

## 首个在线流程

```text
选择在线对战 → 匿名身份 → 创建房间 → 分享邀请 → 朋友加入 → 黑方先手 → 轮流落子 → 结算
```

第一轮只支持两名玩家和私密邀请链接，不做公开匹配、好友系统、排行榜或聊天。

创建者执黑，第二位玩家加入即开局；目前没有昵称、准备按钮、在线悔棋或同房间重开。新一局创建新房间。返回房间入口只停止本机订阅，不会删除云端房间或释放已占座位。

## 建议数据模型

### rooms

| 字段 | 说明 |
| --- | --- |
| id | UUID，房间主键 |
| code | 短邀请码，唯一 |
| game_type | 首期固定为 `gomoku` |
| status | waiting / playing / finished |
| black_player_id | 黑方用户 |
| white_player_id | 白方用户 |
| current_turn | black / white |
| winner | black / white / draw / null |
| created_at | 创建时间 |

### moves

| 字段 | 说明 |
| --- | --- |
| id | 递增序号或 UUID |
| room_id | 所属房间 |
| player_id | 落子玩家 |
| position_x / position_y | 棋盘坐标 |
| move_number | 当前对局步数，房间内唯一 |
| created_at | 落子时间 |

## 同步策略

1. 客户端订阅当前房间的 `rooms` 与 `moves` 变化。
2. 玩家落子时调用数据库函数，而不是直接插入 `moves`。
3. 数据库函数在同一事务中检查玩家身份、轮次、坐标占用和房间状态。
4. 提交成功后由 Realtime 广播数据库变化，两端重新渲染。
5. 断线重连时重新读取房间和全部落子记录，恢复棋盘。

客户端通过 `get_gomoku_snapshot` 在同一查询快照中读取房间与按步数排序的棋子。重连、页面重新可见、网络恢复时重读；页面可见时每 10 秒重读作为事件遗漏的兜底。实时连接未成功或提交结果不确定时禁止落子，不自动重试写请求。

## 身份策略

首版使用 Supabase 匿名登录：玩家不需要注册，但每个浏览器仍有稳定用户 ID。以后需要跨设备战绩时，再升级为邮箱或第三方登录。

身份保存在当前浏览器中。刷新后使用邀请链接点击“加入 / 恢复房间”；清除浏览器数据、无痕窗口关闭或更换设备后不能恢复原座位。两名测试玩家应使用不同设备或独立浏览器会话，同一浏览器的多个标签会共享身份。

## 数据库迁移

首个可执行迁移位于 `supabase/migrations/20260829170000_gomoku_rooms.sql`。它建立房间与落子表、启用 RLS、限制直接写入，并只向已登录玩家开放创建房间、加入房间和落子的数据库函数。

房间邀请码不会通过查询策略公开；玩家必须调用加入房间函数。落子函数会锁定房间记录，校验轮次和格子占用，并在同一事务中更新胜负与下一回合。

`20261001000000_online_room_snapshots.sql` 增加已入座玩家恢复和原子快照读取，必须应用在基础表建立之后。`20260829171000_fix_play_gomoku_move.sql` 是历史修复，不可用作新项目初始化。

## 新 Supabase 项目部署

1. 运行 `npm run db:prepare`，生成 `supabase/setup-gomoku.sql`。文件包含完整基础迁移和恢复/快照补充，外层只有一个事务。
2. 在正确的 Supabase 项目打开 SQL Editor，新建空白查询，完整粘贴生成文件并执行一次。不要追加到旧查询，不要只运行历史修复文件。
3. 执行只读 `supabase/verify-gomoku.sql`：两张表应开启 RLS；四个函数应允许 `authenticated` 调用、拒绝 `anon` 调用；Realtime 应包含两张表；`authenticated` 对表只有 SELECT 权限。
4. 在 Authentication 的 Sign In / Providers 设置中启用 Anonymous Sign-Ins。此设置创建游客用户身份；公开 API key 本身不是玩家身份。
5. 从 Settings 的 API Keys 复制 publishable 或 legacy anon key，填写本地 `.env.local`。浏览器不能使用 secret 或 service_role key；构建配置会拒绝这两种密钥。

生成脚本只用于首次部署。已有表时不要删除表重跑；先核对已应用的迁移，仅执行缺失的升级脚本。云端变更前先确认项目及变更内容；共享已有项目还需保留可恢复备份。

## GitHub Pages 发布配置

仓库 Settings → Secrets and variables → Actions：

- Variables：`VITE_SUPABASE_URL` = Project URL。
- Secrets：`VITE_SUPABASE_ANON_KEY` = 客户端公开密钥。

当前工作流使用上述变量构建，先运行 `npm test` 再发布 `dist/`。本地 `.env.local` 被 Git 忽略。两个值都不设置可发布本地模式；只设置一个会构建失败，防止发布不完整联机配置。

邀请使用站点现有路径的 `?room=8位邀请码`，适用于 `/my-game-site/` 子路径；打开链接会直接显示在线入口。

## 验证

2026-10-01 已在新 Supabase 项目执行完整初始化并启用匿名登录；云端双客户端验证通过，包含真实 Realtime 事件、第三人隔离、落子校验、五连结算和快照一致。本地网页完成创建房间、双方落子同步及刷新恢复检查。首次实时事件测试超时，复测通过。

GitHub Actions 联机配置已保存，[自动部署通过](https://github.com/yelindu/my-game-site/actions/runs/36818545705)。[正式站点](https://yelindu.github.io/my-game-site/) 已验证在线入口、创建房间、邀请子路径及与独立客户端双向落子同步。两台实体设备的公网对战仍需验收。

```text
npm test
npm run build
npm run test:online
```

`test:online` 从 `.env.local` 读取配置，检查匿名登录、创建/加入/恢复房间、第三人拒绝、私密读取、直接写入拒绝、真实 Realtime 事件、回合及占位拒绝、五连结算和双方快照一致。会创建 3 个游客身份和 1 个测试房间，测试结束保留这些记录，不删除云端数据。

`scripts/check-gomoku-db.mjs` 可在临时安装的 PGlite PostgreSQL 中验证全部迁移、RLS、四方向五连和完整 225 步平局。它不依赖云端，不等同于云端部署验证。

最终仍需两台设备打开发布后的站点完成一局，验证触屏操作、邀请链接、刷新恢复和网络中断后的恢复。

## 失败状态

- 邀请码不存在或格式不正确（首版没有到期机制）
- 房间已满
- 自己的连接断开；首版不提供对手在线状态或自动判负
- 重复落子或不是当前回合
- 网络超时后提交结果不确定

界面必须明确展示这些状态，并允许重新连接或返回大厅。
