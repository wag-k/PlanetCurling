# CI/CD・GitHub Pages設定

このリポジトリは、GitHub ActionsでPull Requestを検証し、`master`の検証済み成果物をGitHub Pagesへ公開します。旧`PlanetCurlingExe`リポジトリへのコピーやpushは不要です。

## ワークフロー

### Pull Request

`master`向けPull Requestでは `.github/workflows/ci.yml` が次を実行します。

```text
npm ci
↓
npm run build
↓
npm test
```

このワークフローはHTMLのexportやPagesへのdeployを行いません。

### GitHub Pages

`master`へのpush、またはActions画面からの手動実行で `.github/workflows/pages.yml` が次を実行します。

```text
npm ci
↓
npm run build
↓
npm test
↓
npm run export-html
↓
game/をPages artifactとしてupload
↓
github-pages Environmentへdeploy
```

buildまたはtestが失敗した場合、exportとdeployは実行されません。短時間に複数の更新があった場合は、新しい実行を優先するため古い未完了のdeployをキャンセルします。

## 初回のGitHub Pages設定

リポジトリ管理者がGitHub上で次を確認してください。

1. リポジトリの **Settings** を開く。
2. **Pages** を開く。
3. **Build and deployment** の **Source** で **GitHub Actions** を選ぶ（選択欄が表示される場合）。
4. **Actions** タブで **Deploy GitHub Pages** を開き、`workflow_dispatch`の **Run workflow** から初回deployを実行するか、`master`へ変更をmergeする。
5. 成功したdeploy jobに表示されるURLから公開ページを確認する。

追加のSecretやPersonal Access Tokenは不要です。WorkflowはGitHubが発行するOIDCトークンとPages権限を使用します。

## Pull Requestの品質ゲート

Workflowの追加だけでは、失敗したPull Requestのmerge禁止は保証されません。リポジトリ管理者は **Settings** → **Rules** → **Rulesets** で`master`を対象にしたbranch rulesetを作成し、少なくとも次を有効にしてください。

- Pull Request経由の変更を必須にする。
- merge前のstatus checkを必須にし、CIの **Build and test** を選ぶ。
- 必要に応じて、直接pushを制限する。

Rulesetを使えないプランまたは構成では、**Settings** → **Branches** のbranch protection ruleで同等の設定を行ってください。設定後は、CIを一度実行したPull Requestで必須status checkを選択できることを確認します。

## 障害時の確認

- Pull Requestの検証失敗: **Actions** → **CI** で失敗したbuild/test stepを確認する。
- Pagesの公開失敗: **Actions** → **Deploy GitHub Pages** でbuild、test、export、artifact upload、deployの順に確認する。
- 手動再実行: **Actions** → **Deploy GitHub Pages** → **Run workflow** を選ぶ。
