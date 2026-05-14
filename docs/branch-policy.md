# 分支与发布规范

本仓库使用 `main` 作为受保护的集成分支。

## 必要流程

1. 从 `main` 创建 feature 和 fix 分支。
2. 合并到 `main` 前必须提交拉取请求。
3. 拉取请求应聚焦于单一功能变更或交付事项。
4. 合并前要求 CI 工作流通过。
5. 涉及流水线、部署、安全和监控变更时，要求 `CODEOWNERS` 审核。

## 分支命名

- `feature/<short-name>` 用于产品功能开发。
- `fix/<short-name>` 用于缺陷修复。
- `ops/<short-name>` 用于 CI/CD、部署和监控。
- `release/<version>` 用于发布准备（按需使用）。

## 发布标签

生产发布使用与包版本匹配的标签：

- `vYYYY.M.D`
- `vYYYY.M.D-N`
- `vYYYY.M.D-beta.N`

发布工作流执行包检查、发布容器镜像，可发布 npm，并可通过受保护的 GitHub 环境部署到 Kubernetes。

## 仓库保护设置

在远程 Git 提供商中配置以下设置：

- 保护 `main` 分支。
- 合并前要求拉取请求。
- 要求状态检查：`CI / Quality Gate` 和 `CI / Docker Build Smoke`。
- 要求线性历史（除非团队明确使用合并提交）。
- 要求 CODEOWNERS 审核。
- 限制谁可以推送匹配 `v*` 的标签。
