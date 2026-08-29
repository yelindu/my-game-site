# 在线联机方案

## 首个在线流程

```text
输入昵称 → 创建房间 → 得到邀请链接 → 朋友加入 → 双方准备 → 轮流落子 → 结算
```

第一轮只支持两名玩家和私密邀请链接，不做公开匹配、好友系统、排行榜或聊天。

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

## 身份策略

首版使用 Supabase 匿名登录：玩家不需要注册，但每个浏览器仍有稳定用户 ID。以后需要跨设备战绩时，再升级为邮箱或第三方登录。

## 失败状态

- 邀请码不存在或已过期
- 房间已满
- 对手断线
- 重复落子或不是当前回合
- 网络超时后提交结果不确定

界面必须明确展示这些状态，并允许重新连接或返回大厅。

