# 深潮观测站 · Boss 点位速查

基于 Vue 3 + TypeScript + Vite + Tailwind CSS 4 + shadcn-vue 的纯静态网页，适用于 Creatures of the Deep 社区点位查询。

## 本地运行

使用 Node.js 24 LTS。

```sh
npm ci
npm run dev
```

打开终端输出的本地地址。生产构建与预览：

```sh
npm test
npm run build
npm run preview
```

## 部署到 GitHub Pages

1. 将此目录的源代码（包括 `images/`、`package-lock.json`、`.github/`）上传到 GitHub 仓库的 `main` 或 `master` 分支；不要上传 `node_modules/` 和 `dist/`。
2. 在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送代码，或在 **Actions → Deploy to GitHub Pages → Run workflow** 手动运行。
4. 工作流成功后，Pages 设置页会显示网站地址。

工作流先运行点位和资源检查，再构建、发布 `dist/`。Vite 使用相对资源路径 `base: './'`，支持仓库子路径、根路径和自定义域名。本项目没有依赖服务器重写的路由。

参考：[Vite 静态部署文档](https://vite.dev/guide/static-deploy)、[shadcn-vue Vite 安装文档](https://www.shadcn-vue.com/docs/installation/vite)。

## 补充参考图片

继续往根目录 `images/` 放图，无需手动改代码或维护图片清单。

| 文件名示例   | 含义                                              |
| ------------ | ------------------------------------------------- |
| `7-3-0.jpg`  | 图 7 泰国，3 号点位：地图位置，用于判断船停在哪里 |
| `7-3-1.jpeg` | 同一点位，黑水投放参考位置 1                      |
| `7-3-2.jpeg` | 同一点位，黑水投放参考位置 2                      |
| `7-3-3.webp` | 同一点位，黑水投放参考位置 3                      |

- 格式为 `地图编号-点位编号-图片序号.扩展名`；`0` 专门表示地图定位图，正整数表示黑水参考图。
- 支持 `jpg`、`jpeg`、`png`、`webp`、`avif` 及全大写扩展名；同一序号保留一张图，避免重复。
- 序号按数字排序（`2` 在 `10` 前）；可有间隔。
- 地图定位图可以缺省，页面会明确显示“待补充”，不会把黑水图当作地图图。
- 缩略图可以裁切；主要参考图和放大视图完整展示图片，避免丢失位置线索。
- 图片在构建时自动发现。新增后重新构建或推送到 GitHub，让 Actions 重新发布。
- 新增已知地图的新点位时，点位按钮会自动出现；**图片本身不会修改每日轮换数据**。

地图编号：1 天堂岛、2 北美五大湖、3 哥斯达黎加、4 阿拉斯加、5 澳大利亚、6 苏格兰、7 泰国、8 亚马逊。

## 点位与刷新规则

`src/lib/schedule.ts` 保留原版的点位数据：以 2025-12-15 为基准，按 26 天周期计算。测试中保存了独立的周期数据快照，用于验证轮换结果；运行、测试和构建均不依赖原版 HTML 文件。

刷新规则同样沿用原版：北美服 05:00，其他地区服 04:00，均按**用户设备本地时间**计算，不代表服务端绝对时区。默认依设备时区猜测地区，用户可手动切换，偏好保存在本地浏览器。

“今天”代表当前生效日期，刷新时自动跟进；“昨天 / 明天”始终相对此日期，不会重复点击后继续偏移。手动日期查询不随刷新跳转。轮换属于社区参考，实际请以游戏内情况为准。

## 主要文件

- `src/App.vue`：查询界面、图鉴、图片查看器和复制操作。
- `src/lib/schedule.ts`：轮换、日期和刷新逻辑。
- `src/lib/maps.ts`、`src/lib/image-index.ts`：地图名称、图片发现和分类。
- `src/components/ui/`：由官方 shadcn-vue CLI 生成的组件，可用 `npx shadcn-vue@latest add ...` 扩展。
- `src/style.css`：主题、响应式布局与无障碍动效偏好。
- `.github/workflows/deploy.yml`：Pages 自动发布。
- `tests/`：原版周期回归、刷新边界和图片覆盖验证。

界面不依赖远程字体、图片 CDN 或后端服务。
