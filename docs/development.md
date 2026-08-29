# 开发指南

## 环境

- Node.js 22 或更新的长期支持版本
- npm
- Git

## 常用命令

```bash
npm install      # 首次安装依赖
npm run dev      # 本地开发
npm run build    # 生成 dist/ 发布文件
npm run preview  # 本地预览生产构建
```

## 开发原则

1. 每次只推进一个可试玩切片：规则、界面、本地对局、在线房间依次完成。
2. 游戏规则写成纯函数；出现分支或循环时，补一个最小可运行测试。
3. 游戏目录统一维护在 `src/gameCatalog.js`，不要在多个页面重复写名称和状态。
4. 所有页面需要键盘可用、触屏可用，并支持窄屏。
5. 只有真正实现在线房间时才安装 Supabase 客户端。

## 环境变量

在线阶段复制 `.env.example` 为 `.env.local`：

```text
VITE_SUPABASE_URL=https://项目标识.supabase.co
VITE_SUPABASE_ANON_KEY=匿名公钥
```

`.env.local` 已被 Git 忽略。`VITE_` 变量仍会出现在浏览器中，所以只能放可公开的客户端配置。

## 提交前检查

```bash
npm run build
```

再手动确认首页、手机宽度、导航锚点和按钮状态均正常。

