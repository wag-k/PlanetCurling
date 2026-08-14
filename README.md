# PlanetCurling

PlanetCurlingは、惑星同士の万有引力を使ったカーリング風ゲームを目指すAkashic Engine製のプロトタイプです。現在はPhase G4として、ローカル2人対戦、得点・軌道表示に、惑星衝突と中央天体への吸収を追加しています。

## 現在できること

- Red / Blueのローカル2人対戦
- 各プレイヤー3投、交互に合計6投するターン進行
- 現在ターンの惑星をドラッグして初速度を決める操作
- 基準速度を1.5倍したドラッグ投球
- 投球後に10ゲーム年だけ進み、照準中は停止する物理シミュレーション
- 投球済み惑星を盤面とPhysicsWorldへ残す多体重力
- 中心天体を追従する半径2 AUのターゲット軌道と位置得点帯
- 相対位置と相対動径速度を使う0～3点の暫定採点（1人最大9点）
- 6投終了時のRed勝利・Blue勝利・引き分け
- 本番と同じ多体重力・積分器・6時間dtによる10年先の軌道予測
- 投球時の予測を残し、後続天体の重力によるズレを比較できる実軌跡
- 6時間dtでもすり抜けを抑える連続円衝突判定と、質量差を考慮した投石同士の反発
- 中央天体へ接触した投石の吸収、得点0、接触点で終わる軌跡
- 投石衝突と吸収を区別する短時間フラッシュ
- 現在ターン・投球数・得点・勝敗表示とNew Game
- 6時間の固定物理タイムステップ
- Symplectic Euler / Velocity Verletの切り替え
- Akashic Engineに依存しない物理層の単体テスト

回転・摩擦・トルク、CPU、ネット対戦などはまだ実装していません。

## 遊び方

1. 画面上の現在プレイヤー（Redは`planet1`、Blueは`planet2`の画像）をドラッグします。
2. ドラッグ中は10年先の予測が点線で表示されます。点線リングを位置の目安に離すと投球が確定します。
3. 投球後は物理世界が10ゲーム年進み、実際に通った経路が実線で延びます。
4. 盤面が停止したら次のプレイヤーが投球します。
5. リリース済み惑星は、中心天体との距離と相対動径速度から暫定採点されます。
6. RedとBlueが3投ずつ終えると得点を確定し、勝敗を表示します。
7. 右上の **New Game** で中央天体、投球、得点、勝敗、全軌跡を初期化できます。

照準中は物理時間が停止するため、過去の惑星は動きません。投球済み惑星は中央天体や後続の投球惑星と同じNewton重力の重力源になり、互いに衝突すると反発します。中央天体へ接触した投石だけは吸収され、物理世界と重力源から除外されて得点0になります。過去の惑星を再度ドラッグすることはできません。

画面上の`Dotted`は投球時点の予測、`Solid`は実軌跡です。予測時に存在しなかった後続惑星が追加されるため、過去の実軌跡が保存済み予測から外れることは正常なゲーム挙動です。

## 技術構成

- TypeScript 3.9
- Akashic Engine 3
- Jest / ts-jest
- ESLint

物理モデル、重力計算、積分器、固定刻みランナーはAkashic Engineに依存しません。Akashic固有のSceneとSpriteは `src/main.ts` と `src/rendering.ts` に閉じ込め、1フレームに必要な物理サブステップをすべて終えた後で描画を1回同期します。

## ディレクトリ概要

```text
src/
  main.ts                 Akashic Sceneの構築とイベント接続
  planet.ts               Akashic非依存の天体モデル
  physics_world.ts        同時刻の天体群
  gravity.ts              Newton重力による全加速度計算
  physics_integrator.ts   2種類の積分器と切り替え
  simulation_runner.ts    accumulator付き固定刻み実行器
  collision.ts            連続円衝突判定・反発・中央吸収
  trajectory.ts           Akashic非依存の予測計算・sample記録
  game_balance.ts         SI単位の暫定ゲームバランス値
  match_controller.ts     プレイヤー・駒・状態・ターン進行
  orbit_score.ts          Akashic非依存の軌道評価と得点計算
  rendering.ts            物理モデルからSpriteへの同期
  input_velocity.ts       ドラッグ量から初速度への変換
  universe.ts             入力・ゲーム進行・描画の調停
spec/                     単体・数値回帰・起動テスト
docs/                     設計文書
image/, audio/             既存アセット
```

## セットアップと実行

Node.js 24を用意し、リポジトリ直下で次を実行します。CIも同じメジャーバージョンを使用します。

```sh
npm ci
npm run build
npm start
```

Akashic Sandboxが表示するURLをブラウザで開いて動作を確認します。

## テストとlint

```sh
npm test
npm run lint
```

## 開発フロー

変更はfeature branchから`master`向けPull Requestを作成します。Pull Requestではbuildとtestだけを行い、GitHub Pagesへは公開しません。merge後の`master`で再度buildとtestを行い、成功した場合だけHTMLをexportして公開します。

```text
feature branch
↓
Pull Request
↓
CI build
↓
CI test
↓
master merge
↓
build
↓
test
↓
HTML export
↓
GitHub Pages deploy
```

## ローカルでの公開前確認

GitHub Actionsと同じ順序で確認します。

```sh
npm ci
npm run build
npm test
npm run export-html
```

`npm run export-html`はリポジトリ内の`game/`へ、`index.html`、JavaScript、アセットなどの静的ファイルを生成します。`game/`は一時成果物でありGit管理しません。ローカルでは`game/index.html`をブラウザで開いて確認できます。ブラウザの制約で直接開けない場合は、任意のローカルHTTPサーバーから`game/`を配信してください。

## GitHub Pages

- `master`へのpushで **Deploy GitHub Pages** ワークフローが起動し、自動更新します。
- Pull Requestの時点では公開しません。
- buildまたはtestに失敗した成果物は公開しません。
- deployに失敗した場合は、GitHubの **Actions** タブで失敗したstepを確認します。
- **Deploy GitHub Pages** の `workflow_dispatch`（**Run workflow**）から手動deployを再実行できます。
- 旧`PlanetCurlingExe`リポジトリへのexport、コピー、pushは行いません。

GitHub Pagesの初回有効化と、CI成功をmerge条件にするRulesetの設定は[CI/CD・GitHub Pages設定](docs/deployment.md)を参照してください。

## 物理シミュレーション設定

設定は `src/setting.ts` に集約しています。

- `Setting.PhysicsStepSeconds`: 物理計算1回の時間。初期値は6時間（21,600秒）
- `Setting.SimulationSecondsPerSecond`: 実時間1秒あたりに進めるゲーム内時間。初期値は900日相当
- `Setting.SimulationDurationPerShotSeconds`: 1投後に進める時間。365日基準の10年
- `Setting.ShotsPerPlayer`: 各プレイヤーの投球数。現在は3投
- `Setting.IntegratorKind`: 使用する積分器
- `Setting.InputVelocityReferenceSeconds`: ドラッグ速度換算の基準時間。物理dtとは独立
- `Setting.LaunchVelocityMultiplier`: 基準発射速度へ最後に掛ける倍率。現在は1.5
- `Setting.ScoreVelocityReferenceSeconds`: 動径速度を距離誤差へ換算する時間。現在は1年
- `Setting.PredictionDurationSeconds`: 軌道予測期間。現在は本番1投と同じ10年
- `Setting.TrajectorySampleIntervalSeconds`: 予測・実軌跡の描画sample間隔。現在は10日

暫定ゲームバランス値は`src/game_balance.ts`へ集約しています。中央天体は`6 × 10^26 kg`、投球惑星は`6 × 10^24 kg`（中央天体の1%）です。衝突半径は描画・物理モデルの半径と独立しており、投石0.15 AU、中央天体0.25 AU、投石同士の反発係数は0.9です。万有引力定数やNewton重力式は変更していません。

積分器を変更するには `Setting.IntegratorKind` を次のいずれかへ変更します。

```ts
return PhysicsIntegratorKind.SymplecticEuler;
return PhysicsIntegratorKind.VelocityVerlet;
```

詳細な数式、更新順序、時間設定、拡張ポイントは [物理シミュレーション設計](docs/physics-simulation.md) を参照してください。
現在のゲームルール、物理層との境界、今後の実装順は[ゲーム設計](docs/game-design.md)を参照してください。

## 既知の制約

- 衝突対象外の天体を追加して同一位置へ置いた場合は、Newton重力の特異点となるため計算を停止します。
- 衝突は平面上の円として扱い、回転・摩擦・トルク・変形は計算しません。
- 表示する予測線はactiveStoneだけです。clone世界内では既存投石も同じ衝突処理へ参加します。
- 点線リングは位置誤差だけの目安です。実際の得点には相対動径速度も加わります。
- 暫定得点は現在の物理状態から毎回再計算するため、後続投球の重力で過去の得点が変化します。
- 予測は現在盤面だけを基準にするため、後から追加される投球惑星の影響は予測できません。
- 10日ごとのsamplingで描画点を削減していますが、予測物理計算自体は6時間dtの全14,600ステップです。
- 投球惑星の質量、発射位置、得点閾値はG2用の暫定値であり、プレイテスト後の調整が必要です。
- 6時間dtは現在の初期条件向けの既定値で、すべての軌道の精度を保証しません。
- シミュレーション速度が高いため、1画面更新で多数の固定ステップを実行します。
- 速度・重力ベクトルの表示は既存の簡易表示で、物理量を厳密な縮尺で描いてはいません。
