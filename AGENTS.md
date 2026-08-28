# AGENTS.md

## プロジェクト概要

PlanetCurlingは、軌道力学と万有引力を利用したAkashic Engine / TypeScript製のカーリング風物理ゲームです。

ゲームの中心コンセプトは次の通りです。

> 一投するたびに、次のターンの重力場そのものが変化する。

プレイヤーは惑星を投げ、重力を利用してターゲット軌道を狙います。

投球済みの惑星は盤面に残り、次の投球でも重力源として働きます。また、惑星同士を衝突させたり、相手の惑星を中央天体へ落として吸収させたりできます。

このファイルは、CodexなどのCoding Agentがこのリポジトリで作業する際の恒常的な指示を定義します。

詳細仕様をすべてこのファイルへ記述するのではなく、詳細についてはリポジトリ内の設計文書を参照してください。

---

# 情報源の優先順位

大きな変更を行う前に、対象に応じて以下を確認してください。

- `README.md`
  - 現在の機能
  - 遊び方
  - セットアップ
  - ロードマップ
- `docs/game-design.md`
  - ゲームルール
  - ゲームアーキテクチャ
- `docs/physics-simulation.md`
  - 物理計算
  - 積分器
  - 衝突処理
- `docs/deployment.md`
  - CI/CD
  - GitHub Pages
- `src/setting.ts`
  - シミュレーション時間
  - ゲーム進行設定
- `src/game_balance.ts`
  - 物理定数
  - ゲームバランス値

ドキュメントとコードが食い違っている場合は、勝手に一方を正しいと判断せず、現在の実装とテストを確認してください。

仕様の不一致を発見した場合は、作業結果で明示してください。

---

# 技術構成

現在の主要技術は以下です。

- TypeScript 3.9
- Akashic Engine 3
- Jest / ts-jest
- ESLint
- CI: Node.js 24
- GitHub Pages
- 論理解像度: `1280 × 720`

`package.json`で現在指定されているバージョンとの互換性を維持してください。

明確な必要性がない限り、新しいUIフレームワークや大規模な依存ライブラリを追加しないでください。

---

# アーキテクチャ境界

既存の責務分離を維持してください。

## Physics Layer

物理層はAkashic Engineに依存させないでください。

主なファイル:

- `planet.ts`
- `physics_world.ts`
- `gravity.ts`
- `physics_integrator.ts`
- `simulation_runner.ts`
- `collision.ts`
- `trajectory.ts`

これらの純粋物理コードへ、

```text
g.*
Scene
Sprite
Label
```

などのAkashic依存を持ち込まないでください。

---

## Game Rule Layer

`MatchController`は、主に以下を管理します。

- Player
- Turn
- End
- Stone
- Score
- Match state
- Match result

描画処理を`MatchController`へ追加しないでください。

---

## Application / Orchestration Layer

以下のようなクラスは、ゲームロジック・入力・CPU・描画を接続する調停層として扱います。

- `Universe`
- `CpuTurnController`
- その他Controller / Coordinator

純粋な物理計算をこの層へ重複実装しないでください。

---

## Presentation Layer

Akashic Engine固有の描画は、以下のようなViewクラスへ閉じ込めてください。

- `rendering.ts`
- `game_hud_view.ts`
- `rules_overlay_view.ts`
- `game_mode_view.ts`

Presentation側で、

- Physics
- Score
- Collision判定
- CPU評価

を再実装しないでください。

---

# 現在の試合ルール

1試合は2 Endです。

各Endで、Red / Blueはそれぞれ3投します。

## End 1

投球順:

```text
1. Red
2. Blue
3. Red
4. Blue
5. Red
6. Blue
```

Redが先手です。

BlueがEnd最後の投球を行います。

## End 2

投球順:

```text
1. Blue
2. Red
3. Blue
4. Red
5. Blue
6. Red
```

Blueが先手です。

RedがEnd最後の投球を行います。

---

## End間の盤面

End終了後は盤面を完全にリセットします。

次のEndへ以下を持ち越さないでください。

- Planet
- Stone
- Trajectory
- Collision state
- PhysicsWorld state
- CentralBody state

End終了時点で得点を確定します。

2 Endの得点合計でMatch Resultを決定します。

---

# 得点ルール

ターゲット軌道は動的な中央天体を中心とします。

得点は以下の2要素から計算されます。

1. ターゲット軌道からの動径方向位置誤差
2. 動径速度によるペナルティ

概念式:

```text
effectiveOrbitError
=
radialDistanceError
+
abs(radialVelocity)
* ScoreVelocityReferenceSeconds
```

得点は既存の閾値に基づいて、

```text
3 points
2 points
1 point
0 points
```

へ変換されます。

---

## 得点計算のSingle Source of Truth

得点式と得点閾値は一箇所だけを正としてください。

以下へ得点計算を重複実装しないでください。

- HUD
- Rendering
- Rules UI
- CPU UI
- Score Details UI

必ず既存の、

```text
OrbitScoreEvaluator
```

および、

```text
GameBalance
Setting
```

の値を利用してください。

---

## 得点リングについて

盤面に表示される得点リングは、

**位置誤差だけを視覚化したガイド**

です。

リング内に見えるStoneでも、動径速度が大きい場合は実際の得点が低下する可能性があります。

UIでリングを「その中に入れば必ずその点数になる領域」と誤解させないでください。

---

# Physics Invariants

明示的にPhysicsまたはBalance変更を依頼されていない限り、以下を変更しないでください。

- Newton重力モデル
- 質量
- 万有引力定数
- Collision radius
- Restitution
- Target Orbit radius
- Score thresholds
- Launch multiplier
- Simulation duration
- Prediction duration
- Base physics timestep

現在のbase physics timestepは、

```text
6 game hours
```

です。

---

## Collision substep

Collision処理のために、1つの6時間base stepを内部的に分割することは可能です。

ただし、

```text
Setting.PhysicsStepSeconds
```

自体を勝手に変更しないでください。

---

## 衝突時系列

同一base stepに複数Collision候補がある場合は、

**最も早いTime Of Impact**

から処理してください。

配列順や、

```text
Sun collision first
```

などの固定優先処理へ戻さないでください。

---

## 衝突後の残時間

Collision後の残り時間も、

**すべてのbodyを同じIntegratorで**

進めてください。

過去に存在した、

```text
colliding pair only
position += velocity * remainingTime
```

のような処理へ戻さないでください。

---

# Prediction Invariants

PredictionとActual Gameplayでは、同じ以下の処理を使用してください。

- Gravity model
- Integrator
- Fixed timestep
- Collision system
- Central-body absorption

Prediction専用の簡易Physicsを追加しないでください。

同じ、

```text
initial world
initial velocity
```

であれば、PredictionとActualは数値誤差の範囲内で一致する必要があります。

---

# CPU Invariants

CPUはHumanと同じ、

- Physics
- Collision
- Score
- Launch rule

を使用します。

CPU専用ルールを追加しないでください。

---

## CPU candidate simulation

CPU candidate評価はclone世界で行ってください。

CPU探索によってLiveの、

```text
PhysicsWorld
Planet
Stone
MatchController
```

を変更してはいけません。

---

## CPU determinism

明示的にRandomnessを追加する仕様でない限り、

同じ、

```text
Board state
Difficulty
```

からは同じ投球を選択する決定論的挙動を維持してください。

---

## CPUの不正な高速化は禁止

CPUだけ以下を変更してはいけません。

- 粗いPhysics timestep
- 短いSimulation duration
- Collision無効化
- 異なるGravity
- 異なるScore
- Humanには不可能なLaunch velocity

CPUの探索性能上問題がある場合は、まずCandidate数や探索方法を改善してください。

---

## CPU Planning

CPU探索はBrowser UIを長時間ブロックしないよう、Incremental Planningを維持してください。

候補ごとに最終評価だけが必要な場合、すべてのCandidateについてTrajectory表示用データを生成しないでください。

最終的に選ばれた投球だけPredictionを生成してください。

---

# 単位

Physics内部では原則としてSI単位を使用してください。

可能な限り名前で単位を明示してください。

例:

```text
...Metres
...MetresPerSecond
...Seconds
...Kg
```

AUやGame Yearへの変換は、基本的にPresentation側で行ってください。

非自明な数値には、コメントで単位を記載してください。

Screen pixelとPhysical metreを暗黙的に混在させないでください。

---

# Responsive UI

ゲーム内部の論理解像度は、

```text
1280 × 720
```

で固定します。

Device対応は、

```text
View
HUD
Input
HTML export
```

側で行ってください。

---

## 対応端末

以下を維持してください。

- Desktop
- Smartphone Landscape
- Tablet

小画面対応のためにPhysicsやLaunch velocityを変更しないでください。

---

## ResponsiveLayout

新しいUI座標を追加する場合は、

```text
ResponsiveLayout
```

を利用してください。

UIクラスへ大量のマジックナンバーを直接追加しないでください。

---

## Touch target

Touchable領域は、Visual Spriteより大きくして構いません。

ただしゲーム入力を受け付けるのは、

**現在のHuman-controlled active stone**

だけです。

過去StoneやCPU StoneへHuman inputを接続しないでください。

---

# Rules / Modal Overlay

Rules / How to Playは、

- Match開始前
- Gameplay中

の両方から利用可能である状態を維持してください。

Modal overlay表示中は必要に応じて、

- Physics simulation
- CPU planning
- CPU preview countdown
- Human gameplay input

を停止してください。

Overlayを閉じたら、同じ状態から正常に再開してください。

---

# Generated Files

以下は生成成果物です。

```text
game/
```

ここを手作業で編集しないでください。

GitHub Pages用HTML/CSS変更は、再export可能な形にしてください。

例えば現在の、

```text
export/mobile-support.html
```

のような管理対象ファイルを使用してください。

---

## 廃止済みDeployment

旧、

```text
PlanetCurlingExe
```

リポジトリを利用するDeploymentフローへ戻さないでください。

現在はPlanetCurlingから直接GitHub Pagesへdeployします。

---

# コーディング規約

既存コードのTypeScriptスタイルへ合わせてください。

---

## コメント必須

以下には責務が分かるコメントを付けてください。

- Class
- Method
- Property

特に複雑な、

- Physics
- Collision
- CPU
- Match progression
- Score calculation

については、

「何をしているか」

だけでなく、

「なぜその実装になっているか」

も必要に応じて記載してください。

単位が重要なPropertyには単位も記載してください。

---

## 一般的な実装方針

- 小さく責務の明確なClassを優先する
- Pure logicにできるものはAkashicから分離する
- 同じBusiness logicを複数箇所へ実装しない
- 説明のないMagic numberを避ける
- 調整値は適切なSettings / Balance classへ置く
- 可能な限りDeterministicな挙動を維持する
- Issue外の大規模Refactoringを行わない
- 依頼されていないBalance変更を行わない

---

# テスト方針

挙動変更には原則としてテストを追加してください。

特に以下を保護してください。

- Physics integration
- Gravity
- Chronological collision ordering
- Central-body absorption
- Prediction / Actual parity
- Score thresholds
- End transition
- End間board reset
- Match total score
- CPU clone side-effect
- CPU determinism
- Responsive layout calculation
- Modal pause / resume

Bug fixでは可能な限りRegression testを追加してください。

---

## 既存テストを弱めない

新しい実装を通すためだけに、

- 既存テストを削除
- Assertを弱める
- Numerical toleranceを不必要に広げる

ことは避けてください。

仕様そのものが変更された場合のみ、理由を明確にした上でテストを更新してください。

---

# Git / Branch / Worktree運用

## default branchへ直接実装しない

実装作業をdefault branchへ直接行わないでください。

default branchは、作業開始時の基準および統合先として扱います。

修正・機能追加・Refactoringなどの実装変更は、Task用BranchまたはWorktree上で行ってください。

Documentationだけの軽微な変更であっても、明示的な指示がない限り同じ運用を基本とします。

---

## 作業開始時

作業開始時に、まず現在のdefault branchを確認してください。

その後、最新のdefault branchを基準に作業を開始してください。

既存の作業Branchへ不用意に古い状態から追加実装しないでください。

---

## Task用Branch / Worktree

Task用BranchまたはWorktreeが既に提供されている場合は、それを使用してください。

提供済みの作業環境があるのに別Branchを勝手に作成しないでください。

Task用Branch / Worktreeが提供されていない場合は、

```text
codex/<short-task-name>
```

形式のBranchを作成してください。

例:

```text
codex/score-details
codex/scoring-rings
codex/cpu-end-fix
codex/rules-ui
```

`<short-task-name>`は英小文字とハイフンを基本とし、Task内容が短く識別できる名前にしてください。

---

## Branchの基準

新しいTask Branchは、原則として最新のdefault branchを基準に作成してください。

Branch作成前にdefault branchの最新状態を取得し、現在のTaskが古い基点から始まらないようにしてください。

ただし、既にTask専用WorktreeやBranchが提供されている場合は、その作業状態を尊重してください。

---

# Commit運用

## 1つの巨大Commitにまとめない

作業全体を1つの大きなCommitへまとめないでください。

仕様上意味のある単位ごとにCommitしてください。

例えば、

```text
1. pure score model extension
2. score details UI
3. scoring ring visualization
4. tests
5. documentation
```

のように、レビュー時に目的が理解できる単位へ分割してください。

ただし、細かすぎて意味を持たないCommitへ分割する必要はありません。

各Commitは可能な限り、

- 目的が明確
- Build可能
- 関連Testが通る
- Reviewしやすい

状態を目指してください。

---

## 既存Commitを書き換えない

明示的な指示がある場合を除き、既存Commitを、

- amend
- rebaseによるrewrite
- squash
- force-push前提のhistory rewrite

で変更しないでください。

修正が必要な場合は、新しいCommitとして追加してください。

特に既にRemoteへPush済みのCommit履歴を、勝手に書き換えないでください。

---

## Commit前のTest

各Commit前に、そのCommitの変更内容に関連するTestを実行してください。

例:

Physics変更:

```sh
npm test -- physics
```

Score変更:

```sh
npm test -- orbit_score
```

など、現在のTest構成に合わせて関連Testを選択してください。

利用可能な個別Test commandがない場合は、適切な既存Test commandを使用してください。

Testを実行していない状態でCommitしないことを原則とします。

---

## Commit message

Commit messageは変更の目的が分かる内容にしてください。

例:

```text
feat: add score breakdown model
feat: visualize scoring position bands
test: add score threshold regressions
docs: explain orbit score breakdown
fix: preserve CPU planning across rules overlay
```

曖昧な、

```text
update
fix stuff
changes
```

などは避けてください。

---

# 作業終了前のValidation

Taskの実装が完了したら、RemoteへPushする前にFull Build / Testを実行してください。

コマンドを実行する前に`package.json`を確認してください。

原則として以下を実行します。

```sh
npm ci
npm run build
npm test
npm run lint
npm run export-html
```

実際に存在するscriptを使用してください。

---

## Lintについて

`npm run lint`が自動修正を行う設定の場合があります。

Lint後は必ずDiffを再確認してください。

Lintによる意図しない変更が混入していないことを確認してください。

---

## Full validation後のDiff確認

Full Build / Test / Lint / Export後、最終Diffを確認してください。

以下が混入していないことを確認します。

- `game/`等のGenerated files
- 一時ファイル
- Debug code
- 不要なFormatting変更
- Taskと無関係な変更
- Secret / Credential

---

# Remote Push

作業完了後はTask BranchをRemoteへPushしてください。

default branchへ直接Pushしないでください。

既存Commit履歴を書き換える必要がない限り、通常のPushを使用してください。

`--force`や`--force-with-lease`は、明示指示がない限り使用しないでください。

---

# Pull Request

## 原則としてDraft Pull Requestを作成する

RemoteへPushした後、原則としてdefault branch向けのDraft Pull Requestを作成してください。

Task用PRが既に存在する場合は、新しいPRを重複作成せず、そのPRを使用してください。

明示的に通常PRを作るよう指示されていない限り、初回作成時はDraftを基本とします。

---

## PR本文

PR本文には最低限、以下を記載してください。

### 変更内容

何を変更したか。

### 理由

なぜその変更が必要だったか。

### 影響範囲

どの機能・レイヤー・ゲームルールへ影響するか。

また、意図的に変更していない領域も重要であれば記載してください。

例:

```text
Physics / Score formula / CPU utility weightsには変更なし。
```

### 検証結果

実行した、

- Build
- Test
- Lint
- Export
- Manual playtest

の結果を記載してください。

### 残課題

未解決事項、追加検証が必要な点、Manual playtest項目などを記載してください。

残課題がない場合も、

```text
Known remaining issues: none
```

など、確認済みであることが分かるようにしてください。

---

## PR本文の推奨構成

```markdown
## Summary

- ...
- ...

## Why

- ...

## Impact

- ...

## Validation

- `npm run build` ✅
- `npm test` ✅
- `npm run lint` ✅
- `npm run export-html` ✅

## Manual checks

- ...

## Remaining issues

- ...
```

プロジェクトの既存PR Templateがある場合は、そちらを優先してください。

---

# CI

## CI失敗を完了扱いしない

Pull RequestのCIが失敗している状態を、Task完了として扱わないでください。

CI failureを確認した場合は、原因を調査し、Task Scope内で修正可能なら修正してください。

修正後は新しいCommitを追加し、RemoteへPushしてください。

---

## CIを修正できない場合

External service failure、権限不足、Infrastructure問題など、Agent側で修正できない理由によりCIを成功させられない場合は、PR本文またはPRコメントへ以下を明記してください。

- 失敗しているJob / Step
- エラー内容
- 推定原因
- 実装変更との関連有無
- Agent側で修正できない理由
- 必要な次の対応

CI failureを隠したり、成功したように報告しないでください。

---

# 実行結果の報告

実際に実行していないコマンドを、

```text
passed
successful
```

と報告してはいけません。

Documentationのみの変更などでFull validationを省略した場合は、何を実行しなかったか明示してください。

---

# Secret

以下をCommitしないでください。

- API key
- Password
- Token
- Credential
- Machine-specific secret

Secretらしき値を発見した場合は、Taskと無関係でも新たにCommitへ含めないでください。

---

# 作業終了前チェックリスト

作業を完了扱いする前に、最低限以下を確認してください。

1. 最新default branchを基準に作業した
2. default branchへ直接実装していない
3. 適切なTask Branch / Worktreeを使用した
4. 変更を意味のあるCommit単位へ分割した
5. 既存Commitを勝手にrewriteしていない
6. 各Commit前に関連Testを実行した
7. Full Build / Testを実行した
8. Lint後のDiffを確認した
9. Generated filesや不要ファイルが混入していない
10. Behavior変更時にDocumentationを更新した
11. Task BranchをRemoteへPushした
12. Draft Pull Requestを作成または既存PRを更新した
13. PR本文へ変更内容・理由・影響・検証結果・残課題を記載した
14. CI結果を確認した
15. CI failureが残る場合は原因をPRへ明記した

---

# 最終報告

実装完了時は最低限以下を報告してください。

- 使用したBranch / Worktree
- 変更したBehavior
- 主な変更ファイル
- 重要なDesign decision
- 作成したCommit一覧
- 追加・更新したTest
- Build結果
- Test結果
- Lint結果
- Export結果
- Push結果
- Pull Request URL
- CI結果
- 残っているRisk
- Manual playtestで確認すべき点

CIが成功していない場合は、

**未完了または要対応**

であることを明示してください。

---

# Documentation方針

Game ruleまたはArchitectureを変更した場合は、同じ変更内で関連Documentationも更新してください。

READMEやdocsに旧仕様を残さないでください。

---

## AGENTS.md自体は肥大化させない

`AGENTS.md`は、

- 恒常的な制約
- 重要な設計ルール
- 開発・Git運用ルール
- Navigation

を中心に保ってください。

詳細な仕様説明が大きくなった場合は、

```text
docs/
```

へ移し、AGENTS.mdから参照してください。

---

# Scope Guardrail

明示的に依頼されていない限り、以下を変更しないでください。

- Gameplay balance
- Scoring formula
- Physical constants
- CPU difficulty tuning
- Match format
- Supported device policy
- Deployment architecture

Issueを実装するためにこれらの変更が必要に見える場合は、まず既存仕様を維持したまま解決できないか検討してください。

どうしても変更が必要な場合は、Silent changeにせず、PR本文と最終報告で明確に説明してください。