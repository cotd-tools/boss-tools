# CI/CD 与版本发布

流程：**功能分支 → PR 到 dev → PR 到 main → git push 版本标签 → 自动检查、创建 GitHub Release、发布 Pages**。

## 检查与发布分离

| 场景 | 工作流 | 行为 |
| --- | --- | --- |
| PR 目标为 dev / main：创建、追加提交、重新打开、转为待评审 | CI | 测试、类型检查、生产构建；草稿也检查 |
| 合并 / 推送到 dev 或 main | CI | 检查实际分支提交，不发布 |
| 合并队列检查、手动运行 CI | CI | 只检查，不发布 |
| 推送 v1.2.3 格式的新标签 | Release to GitHub Pages | 验证版本和 main 归属，测试、构建、自动创建 Release，再部署 |
| 预发布标签、删除或强制移动标签 | 不执行正式发布 | 不更新网站 |
| 在 GitHub 手动创建 / 编辑 Release | 不触发工作流 | 不重复部署 |

`.github/workflows/deploy.yml` 只执行 CI，固定检查名称为 **CI**。`.github/workflows/release.yml` 监听版本标签的 `push` 事件，接受 `v1.2.3` 格式的正式标签，不接受 `v1.2.3-rc.1` 等预发布名称；删除或强制移动标签不会执行发布任务。

首次启用时，必须先将这两个工作流及 `scripts/verify-release.mjs` 合并到 `main`，再为包含它们的提交创建版本标签。现有旧版本不会自动补发。

## 日常开发

1. 从最新 `dev` 创建功能分支；本地执行 `npm ci`、`npm test`、`npm run build`。
2. PR 合并到 `dev` 前，等待 `CI` 成功并完成界面检查。
3. 准备发布时，从 `dev` 向 `main` 提 PR。长期分支间建议用 **Create a merge commit** 保留共同历史；功能分支 PR 可以 Squash。
4. `main` PR 的 CI 通过、讨论解决后合并，再确认 `main` 的 CI 通过。
5. 为已确认的 `main` 提交打版本标签并推送，其余流程自动完成。

CI 使用 Node.js 24，通过 `npm ci` 按锁文件安装，依次运行 `npm test`、`vue-tsc --noEmit` 和 Vite 构建。任何一步失败，后续步骤停止。检查不依赖本地 `images/original/`，不创建 PR 预览站；本地可用 `npm run preview`。

新提交会取消同一 PR / 分支的旧检查，不同引用相互隔离。合并队列的 `merge_group` 事件已支持，但工作流不会自动启用队列。首次外部贡献者的检查可能需要维护者批准运行。

## 打标签并发布

以下 `v1.2.3` 是示例，执行时换成尚未使用的新版本号。在干净工作区中执行：

```sh
git switch main
git pull --ff-only origin main
git tag -a v1.2.3 -m "Release v1.2.3"
git push origin v1.2.3
```

本地标签已存在时，只需最后一条 `git push origin v1.2.3`。不需要执行 `gh release create`，也不需要去 GitHub 点击发布。工作流自动生成 Release 说明，并在创建成功后部署 Pages。

发布工作流固定检出标签推送事件的 SHA，并验证：

- 标签符合稳定版本格式，且标签解析出的提交与事件 SHA、实际检出提交一致。
- 该提交已包含在 `origin/main` 历史中；仅存在于 dev / 功能分支的提交不能通过校验。
- 对该版本重新执行测试、类型检查和生产构建；部署同次运行产生的 `dist/`，不使用其他分支或其他运行的产物。

构建任务只有读取权限；创建 Release 的任务单独使用 `contents: write`；部署任务单独具有 `pages: write` 和 `id-token: write`。创建 Release 和部署在同一次工作流内串联，不依赖 `GITHUB_TOKEN` 创建 Release 后再触发另一个工作流，也无需额外配置 PAT。

发布使用独立的 `github-pages` 并发组，正在执行的发布不取消；多个待执行版本可能仅保留最新待执行任务，因此应等待本次发布完成再发布下一版本。普通 CI 更新不会打断正式发布。

测试或构建失败，不创建 Release、不部署。重试时，若该标签已有正式 Release，则复用并保留原说明；若同名 Release 是草稿或预发布，会停止并提示维护者处理。Release 创建成功但部署失败时，Release 会保留，网站是否上线以 `Deploy Pages` 的结果为准。

不要移动或复用已发布标签。需要修复时创建新版本。

## main 分支保护

规则源文件：`.github/rulesets/protect-main.json`。它可在 **Settings → Rules → Rulesets → New ruleset → Import a ruleset** 导入。文件本身不会自动应用或同步 GitHub 设置；已有同名规则时编辑原规则，避免重复创建。

规则要求：

- 必须通过 Pull Request 合并。
- GitHub Actions 提供的 **CI** 必须成功，且合并前分支与 main 保持最新。
- 所有评审讨论已解决。
- 禁止删除 main、禁止强推。
- 不配置绕过角色，管理员也受规则约束。
- 默认不强制第二人批准，便于单人维护；多人协作可将批准人数改为 1。

**2026-09-30 已在 cotd-tools/boss-tools 启用 Protect main 规则（ID：24223064）。** 必过检查名为 `CI`，不要将只在标签发布时执行的检查设为 PR 必过项。

dev 可按需添加同类规则。紧急修复也通过 PR 进入 main，之后将 main 同步回 dev。

## Pages 环境设置

1. **Settings → Pages → Source** 选择 **GitHub Actions**。
2. **Settings → Environments → github-pages → Deployment branches and tags** 选择指定分支与标签策略，添加 **Tag：v***。发布引用是标签，不能只允许 main 分支。
3. 移除旧的 **Branch：main** 允许规则，使正式部署只接受版本标签。不要改成所有分支都可部署。

**2026-09-30 已将该仓库的 github-pages 环境改为仅允许 v* 标签。** 因此，在新工作流合并前，旧的 main 自动发布任务会被环境限制拦截；现有网站不受影响。

## 验证、失败与回退

- 发布后打开网站，核对地图、图片、语言切换和手机大图操作。自动检查包含手势逻辑测试，但不包含实体手机触控或浏览器端到端测试。
- CI / 发布测试失败：修复后走 PR 流程，使用新版本发布。
- Pages 404：确认 Pages 已启用且 Source 为 GitHub Actions。
- 标签被环境拒绝：确认环境允许的是 **Tag：v***，不是同名分支规则。
- 创建 Release 或部署暂时失败：在对应标签的工作流中重试失败任务；产物过期时重新运行该标签的全部任务。同一标签重复推送通常只返回 Everything up-to-date，不会重试。不要靠手动 CI 发布，也不要重跑已经被新版本取代的旧发布。
- 线上回退：通过 Revert PR 撤销问题改动，合并到 main 后创建并推送新的修订版本标签，随后同步回 dev。保留旧版本标签和发布记录，不强推 main、不重打旧标签。

参考：[标签推送触发](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushbranchestagsbranches-ignoretags-ignore)、[自动创建 Release](https://docs.github.com/en/rest/releases/releases#create-a-release)、[分支规则](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)。
