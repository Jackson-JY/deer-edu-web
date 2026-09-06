# IELTS 教学管理后台 · 部署说明

管理端是一个独立的 React Web 应用，与小程序共用同一个云环境 `cloud1-d7g66xvli7bb6bcc6`。
通过 `@cloudbase/js-sdk` 调用云函数完成所有读写，前端不直接访问数据库。

> **登录方式**：主推「**账号密码登录**」（无需任何微信资质即可上线）。
> 「微信扫码登录」作为可选增强，列在文末「十、可选增强」中，需要时再启用。

## 一、项目结构

```
admin-web/
├── src/
│   ├── config.js                 # 微信开放平台 AppID 配置（账号密码方案无需填写）
│   ├── cloudbase.js              # CloudBase SDK 初始化 + token 管理
│   ├── api/index.js              # 云函数调用封装
│   ├── pages/
│   │   ├── Login/                # 三 Tab 登录：扫码 / 账号密码 / 开发模式
│   │   ├── AuthCallback/         # 微信扫码回调处理（账号密码方案不用）
│   │   ├── Schedule/             # 排课管理
│   │   ├── Students/             # 学生数据分析
│   │   └── Assessment/           # 测评报告
│   └── layout/AdminLayout.jsx    # 后台布局（侧边栏 + 顶栏）
└── dist/                         # 构建产物（部署到静态托管）
```

## 二、5 分钟快速启动清单（账号密码方案）

按以下顺序操作即可让管理端跑起来，无需微信开放平台资质：

| # | 步骤 | 备注 |
|---|------|------|
| 1 | 微信开发者工具中上传并部署 12 个云函数（清单见第三节） | 全部勾选「云端安装依赖」 |
| 2 | 配置 Web 端访问云函数的通道（**二选一**，详见第四节）：开启「匿名登录」或为 8 个管理端云函数开启「HTTP 访问服务」 | **必须**，否则登录报「登录方式未开启」 |
| 3 | CloudBase 控制台给 `adminLogin`、`initAdmin` 加环境变量 `ALLOW_DEV_LOGIN=true` | 仅初始化阶段需要 |
| 4 | 在云数据库手动创建集合 `admin_sessions`（权限设为「所有用户不可读写」） | 仅一条 |
| 5 | 小程序端用 `isAdmin=true` 的管理员账号登录一次（确保 `users` 集合里有记录） | — |
| 6 | 云开发控制台「云函数测试」调用 `initAdmin`：`{ openid: '上一步的openid', username: 'admin', password: '你的密码' }` | 初始化管理员账号 |
| 7 | 删除 `adminLogin`、`initAdmin` 的 `ALLOW_DEV_LOGIN=true` 环境变量 | **必须执行**，关闭密码重置能力 |
| 8 | `admin-web` 目录 `npm install && npm run build`，把 `dist/` 上传 CloudBase 静态托管 | 或 `npm run dev` 本地预览 |
| 9 | 浏览器访问管理端 URL，登录页选「账号密码」Tab，输入第 6 步设置的账号密码 | 登录成功进入 |

> 完成第 7 步后，开发模式登录 + 密码重置都被关闭，**只有线上记住的密码才能登录**。

## 三、云函数部署清单

### 新增（6 个）

| 云函数 | 作用 | 环境变量 |
|--------|------|----------|
| `adminLogin` | 账号密码 / 微信扫码 / 开发模式登录，签发 token | `ALLOW_DEV_LOGIN`（初始化后必删）、`WX_WEB_APPID`、`WX_WEB_SECRET`（扫码登录才需要） |
| `adminVerify` | 校验 token 有效性 | — |
| `saveCourse` | 排课写操作（单节/循环） | — |
| `adminStats` | 学生数据分析（总览 + 趋势） | — |
| `adminAssessment` | 测评报告（全体分布 + 单生详情） | — |
| `initAdmin` | 初始化管理员账号密码 | `ALLOW_DEV_LOGIN`（初始化后必删） |

### 改造（6 个，已支持 Web 端 token 鉴权，需重新部署）

| 云函数 | 改动 |
|--------|------|
| `getCourses` | verifyAdmin → authenticate（token 优先，openid 兜底） |
| `getAllUsers` | verifyAdmin → authenticate |
| `getAllHomework` | verifyAdmin → authenticate |
| `deleteCourse` | verifyAdmin → authenticate |
| `getOpenId` | 补写 unionid（为将来扫码登录预留） |
| `loginByPhone` | 补写 unionid |

### 部署步骤

1. 在微信开发者工具中，对上述 12 个云函数目录右键 →「**上传并部署：云端安装依赖**」；
2. 在 CloudBase 控制台给 `adminLogin`、`initAdmin` 配置环境变量 `ALLOW_DEV_LOGIN=true`。

## 四、Web 端访问云函数的通道配置（**必须**）

CloudBase Web SDK 调用云函数前需要一个登录态。新版云环境**默认关闭匿名登录**，如果不做以下任一配置，登录时会报「**登录方式未开启**」。

前端 `src/cloudbase.js` 已实现自动降级：优先走 SDK（需匿名登录），失败时自动走 HTTP 调用（需函数开启 HTTP 访问服务）。两种方式**二选一**即可。

### 方案 A：开启匿名登录（最简单，推荐）

1. CloudBase 控制台 →「环境」→「登录授权」→「登录方式」；
2. 找到「**匿名登录**」，点击「开启」；
3. 无需其他配置，前端自动走 SDK `callFunction`。

> 安全说明：匿名登录仅用于让 SDK 建立传输会话，**不授予任何业务权限**。所有管理端接口均通过 `_token` 在云函数内做鉴权，匿名用户无法越权操作。

### 方案 B：为云函数开启 HTTP 访问服务（不开启匿名登录时）

若不想开启匿名登录，需为以下 8 个管理端云函数逐个开启「HTTP 访问服务」：

`adminLogin`、`adminVerify`、`getCourses`、`saveCourse`、`deleteCourse`、`getAllUsers`、`adminStats`、`adminAssessment`

操作：CloudBase 控制台 →「云函数」→ 选中函数 →「函数配置」→「HTTP 访问服务」→ 开启。

开启后，前端会自动降级为 HTTP 调用 `https://${envId}.service.tcloudbase.com/${函数名}`，无需匿名登录。

> 已为上述 8 个云函数添加了 `normalizeEvent` 兼容逻辑，可同时处理 SDK 调用和 HTTP 调用两种 event 结构。

## 五、数据库集合

| 集合 | 用途 | 权限 | 是否需要手动创建 |
|------|------|------|------------------|
| `admin_sessions` | 管理员登录 token | 「所有用户不可读写」（云函数管理员权限读写） | ✅ **必须创建** |
| `users` | 用户信息（含 `adminUsername` / `adminPasswordHash`） | 视现有配置 | ❌ 已存在 |
| 其余业务集合 | — | — | ❌ 已存在 |

## 六、前端配置

### 账号密码方案（推荐）

`src/config.js` **保持默认即可**，无需任何修改：

```js
export const CLOUDBASE_ENV = 'cloud1-d7g66xvli7bb6bcc6';
// 微信扫码登录相关字段留空即可
export const WX_APPID = '';
```

### 本地开发

```bash
cd admin-web
npm install
npm run dev        # http://localhost:5173
```

## 七、部署到 CloudBase 静态托管

```bash
cd admin-web
npm run build       # 生成 dist/
```

将 `dist/` 目录上传到 CloudBase 控制台「静态网站托管」（与小程序同一环境）。

## 八、管理员账号管理

### 初始化（首次）

1. **小程序端有管理员账号**：在 `users` 集合中找到 `isAdmin=true` 的记录，拿到它的 `_openid`；
2. **临时开启初始化能力**：给 `adminLogin`、`initAdmin` 配置 `ALLOW_DEV_LOGIN=true`；
3. **调用 `initAdmin` 设置账号密码**：
   ```js
   // 云函数测试 → initAdmin
   {
     openid: 'oXyz123...',   // 上面拿到的管理员 openid
     username: 'admin',       // 自定义
     password: 'YourStrongP@ssw0rd'  // 自定义
   }
   ```
   云函数会更新 `users` 集合对应记录，写入 `adminUsername` + `adminPasswordHash`（sha256 盐哈希，不可逆）；
4. **关闭初始化能力**：删除 `adminLogin`、`initAdmin` 的 `ALLOW_DEV_LOGIN=true`。之后：
   - 「开发模式登录」入口对所有人失效；
   - 「微信扫码登录」（即使后续开放）可被禁用；
   - 密码**无法被重置**——忘记密码需重新手动改库或开临时环境变量。

### 修改密码

方案 A（推荐）：开 `ALLOW_DEV_LOGIN=true` → 用 `initAdmin` 传相同 `openid` + 新 `password` 覆盖（同一个 `adminUsername` 也可）→ 关环境变量。

方案 B：直接改库。把 `users` 里对应记录的 `adminPasswordHash` 字段替换为新密码的哈希（哈希算法 `crypto.createHash('sha256').update(`${username}:${password}:ielts-edu-admin-v1`).digest('hex')`），或直接用云函数临时算一个写进去。

### 日常登录

打开管理端 URL → 登录页选「账号密码」Tab → 输入账号密码 → 进入后台。

## 九、安全要点

| 风险 | 缓解 |
|------|------|
| 密码明文出现在云函数测试请求 | 仅初始化一次性使用，不进代码仓库 |
| `adminPasswordHash` 写在小程序端可见的 `users` 集合 | 哈希 + 唯一盐（`ielts-edu-admin-v1`）不可逆 |
| `ALLOW_DEV_LOGIN=true` 忘记删 | 文档强调、初始化后必须立即删除 |
| token 泄漏 | 有效期 7 天，存 localStorage（Web 端唯一可行方案），退出登录立即失效 |
| `admin_sessions` 集合权限 | 「所有用户不可读写」，仅云函数管理员权限访问 |

## 十、进阶：部署到生产

正式上线推荐步骤：

1. 买个域名（如 `admin.your-domain.com`），CloudBase 静态托管绑定并配置 HTTPS；
2. 前端 `src/config.js` 填入生产环境 `CLOUDBASE_ENV`（通常与开发同环境，如需隔离可新建）；
3. 用 `admin-web/DEPLOY.md` 第八节的流程初始化第一个管理员；
4. 给老师/运营分发账号密码，强密码策略（≥12 位含大小写+数字+符号）；
5. 定期轮换密码（建议 3-6 个月）；
6. 监控 `admin_sessions` 异常登录（可在 `adminVerify` 加日志，统计调用频次和 IP）。

---

## 十一、可选增强：启用微信扫码登录

> 如果希望老师/运营直接微信扫码登录（免输密码），需具备**企业认证的微信开放平台账号**。
> 满足条件后，按本节操作启用即可。前端 + 云函数已全部就绪，无需写新代码。

### 准备工作

1. **微信开放平台企业认证**：需营业执照 + 300 元/年 认证费，1-3 工作日审核；
2. **创建「网站应用」**：拿到 AppID + AppSecret，配置授权回调域；
3. **小程序绑定到同一开放平台账号**：否则扫码拿不到 unionid，无法识别管理员。

### 启用步骤

1. **CORS / 回调域名**：在网站应用「授权回调域」填写 `admin.your-domain.com`；
2. **环境变量**：给 `adminLogin` 配置：
   - `WX_WEB_APPID` = 网站应用 AppID
   - `WX_WEB_SECRET` = 网站应用 AppSecret
3. **前端配置**：编辑 `src/config.js`：
   ```js
   export const WX_APPID = 'wx你的网站应用AppID';
   export const getWxRedirectUri = (origin) =>
     `${origin}/#/auth/callback`;
   ```
4. **unionid 关联**：小程序端已有用户首次登录会通过 `getOpenId`/`loginByPhone` 自动补写 unionid；
5. **重新构建前端**：`npm run build`，重新部署 `dist/`；
6. **测试扫码登录**：登录页选「微信扫码」Tab → 用绑定到开放平台的微信扫码 → 命中 `isAdmin=true` 进入后台。

> 没有 unionid 关联的管理员需要在小程序内重新登录一次，以触发 unionid 写入。

### 何时启用

- 老师数量多（≥3 人）、密码分发/轮换成本高；
- 需要「用户体系打通」，把管理端开放给非管理员账号（按 unionid 扩展权限模型）；
- 已有开放平台资质或愿意承担 300 元/年 认证成本。

否则推荐一直用账号密码方案——它已经够用、安全、可控。
