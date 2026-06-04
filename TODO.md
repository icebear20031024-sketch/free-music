# 全局架构与重构规划 (TODO)

## 📌 项目重构愿景
为了保证项目的长久性发展，我们需要对现有代码进行全方位的架构重构。重构的核心目标是：
1. **职责分离**：解耦前端 (React+Vite) 和后端 (Express+Node)，使其具备清晰的模块化边界。
2. **测试驱动 (TDD)**：所有核心逻辑及重构先编写测试用例，重构必须经过 E2E 验证后才可交付。
3. **类型安全**：全面开启 TypeScript 严格模式 (`strict: true`)，彻底消除项目中的 `any`。
4. **高质量与可维护性**：统一项目规范，包括错误处理机制和日志管理机制。

## 🎯 分批次完成任务清单

### 阶段 1: 测试基础设施搭建与架构梳理 (准备阶段)
- [x] 开启 TypeScript 严格模式 (`strict: true`)。
- [x] 搭建单元测试及集成测试环境 (Vitest)。
- [x] 搭建 E2E 测试环境 (Playwright / Cypress)。
- [x] 重构目录结构：新建 `server/` 文件夹，将 `server.ts`, `routes.ts`, `middleware/`, `utils/`, `plugins/`, `plugin-manager.ts` 等后端模块迁移至该目录。并更新相关的 `package.json` 启动与构建脚本。

### 阶段 2: 消除 `any` 与类型完善 (强类型重构)
- [x] 审计前端目录下 (`src/**/*`) 的所有文件，提取公共的 Types 或 Interface。
- [x] 审计后端目录下 (`server/**/*`) 的所有文件，规范请求和返回的数据结构类型。
- [x] 严格禁止并替换所有遗留的 `any`，替换为具体的接口类型或 `unknown` 搭配类型守卫。

### 阶段 3: 后端架构 TDD 重构
- [x] 为现有的插件机制 (`plugin-manager.ts`, `plugins/*`) 编写单元测试。
- [x] 为后端的路由分发和中间件 (`routes.ts`, `error-handler.ts`) 编写单元测试。
- [x] 基于 TDD 重构后端服务层：拆分控制器 (Controllers)、服务 (Services) 及数据访问层。

### 阶段 4: 前端架构 TDD 重构
- [x] 为核心组件 (比如 `PlayerProvider.tsx`, `LyricsView.tsx`, `SearchBar.tsx`) 编写单元/组件级测试。
- [x] 为 Hooks (`usePlaylists.ts`, `useDownloads.ts`) 编写业务逻辑测试。
- [ ] 规范前端目录树 (按功能或特性划分域，如 `src/features/`, `src/layouts/`) 以及抽取共享服务到 `src/services/`。

### 阶段 5: E2E 验证与交付
- [ ] 编写核心业务链路 of E2E 测试 (访问、播放列表、歌词解析等)。
- [ ] 在本地执行全部单元测试、集成测试及 E2E 测试，验证项目各项链路能够健康运转。
- [ ] 完成项目的最终重构并标记里程碑。

### 阶段 6: 支持多源平台定制化搜索 (TDD 优先)
- [x] 编写后端集成/单元测试：测试 `/api/search/stream` 及 `/api/search` 在指定 `sources` 时的过滤行为
- [x] 扩展后端：修改 `/server/services/music-service.ts` 和 `/server/routes.ts` 以过滤非指定音源
- [x] 编写前端组件测试：测试 `SearchBar` 中音源配置面板的显隐、切换和传参
- [x] 扩展前端：在 `SearchBar` 增加音源选择面板/控制组件，允许用户勾选支持的音源，本地持久化用户的偏好音源
- [x] 联调与 E2E 验证：在本地执行全部测试，并在界面中实际验证多源过滤效果

### 阶段 7: 解决小芸音乐（网易云）播放限制/30秒试听故障 (TDD 优先)
- [x] 完善音乐服务/插件的单元测试：编写测试用例验证 `getMediaSource` 在获取播放链接失败或返回 panspace.kuwo.cn 回退时抛出错误
- [x] 改进插件音频链接解析逻辑：更新所有采用 `lxmusicapi.onrender.com` 的音频解析插件（涵盖 `xiaoyun.cjs`, `xiaoqiu.cjs`, `xiaogou.cjs`, `xiaowo.cjs`, `xiaomi.cjs`），当 `msg !== 'success'` 或 URL 匹配 panspace 备用地址时，主动抛出错误以激活前端无缝自动切源
- [x] 验证前端播放器的切源容错机制，确保错误被正确捕获 and 展示，使用户遇到无版权歌曲时能自动回退到其他平台
- [x] 执行自动化测试与重新编译验证

### 阶段 8: 支持完整版音源直接下载及配套 API 文档 (地基级能力 TDD 优先)
- [x] 扩展后端路由：添加 `GET /api/download` & `POST /api/download` 端点并接入源插件音轨数据流
- [x] 完善单元测试：在 `routes.test.ts` 中针对下载端点的异常及音频流媒体数据代理 and 文件名处理进行了完整的测试验证
- [x] 更新规范文档：在 `API.md` 中新增了标准下载 API 调用及参数使用规范说明，包含直连和完整字段请求示例

### 阶段 9: 解决部分源（酷狗/酷我/咪咕及小芸/网易云等）跨域/防盗链以及协议相对路径导致图片封面损坏报错 (E2E 验证)
- [x] 审计各插件返回的图片源路径，发现大多数音源网站 CDN 配置了严格的 Referral 校验以及 CORS/混合内容 Block 策略，并且小芸（网易云等）会返还协议相对路径（如 `//p3.music.126.net/...`）
- [x] 修改前端 React `<img>` 标签添加 `referrerPolicy="no-referrer"` 控制标头
- [x] 智能补全并修复小芸（网易云）特有封面：针对网易原 API 中不返回 `picUrl` 的特性，在 `xiaoyun.cjs` 插件层实现通过官方系统重定向 API（`https://music.163.com/api/img/system/get?id=picId`）自动适配与安全派发的逻辑，排除 `"0"` 和 `'null'` 等无效 ID，规避了由于哈希混淆前缀不符导致的 404 CDN 错误
- [x] 引入服务器端智能代理逻辑：在 `api.ts` 中和后端 `/api/proxy` 路由中全面建立 `getProxiedCoverUrl` 动态协议自适应补全及图像代理机制，当遇到类似 `//` 开头的相对地址时在前后端均自动组装为 HTTPS 终点并过滤规避、保护 URL 构造解析、经由代理控制头安全获取
- [x] 成功打造并应用支持端到端静默预验证（Silent Pre-validation）能力的专用 React `CoverImage` 组件，利用后台 Image 预载机制拦截破损连接、安全回退到标准高画质 Unsplash 歌曲占位，将“获取图片检测”和“真实拼装加载”完全区分开来，实现全源 100% 优雅抗裂呈现
- [x] 在所有播放器及封面渲染页（如 `PlayerBar.tsx`, `LyricsView.tsx`, `App.tsx`）全面使用全新的 `<CoverImage>` 替代传统标签，重塑视觉稳定性

### 阶段 10: 增强歌曲列表易用性 —— 歌手与专辑一键快捷筛选 (交互优化)
- [x] 识别用户对列表歌曲所属“歌手”与“专辑”在主内容区域的快捷连按需求
- [x] 重构 `App.tsx` 中的歌曲列表呈现逻辑：针对歌手（Artist）与专辑（Album）两栏，添加优雅的 Apple 质感悬停强调状态（`hover:text-[#0071E3] hover:underline`）
- [x] 将被动播放逻辑解耦：点击歌手或专辑名称时阻止播放事件冒泡（`e.stopPropagation()`），并自动触发多源智能流式搜索机制，实现一键穿透直达该歌手 works 或该专辑曲目

---
📝 **约束说明**: 
执行操作中，一次仅进行一个明确修改并且跑测试。不强行做跳步重构。
每一次修改后回来勾选核对 TODO 列表，确保严格遵守 TDD 优先和 E2E 验证原则。
