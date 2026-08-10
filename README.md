# PlanetCurling

PlanetCurlingは、惑星同士の万有引力を使ったカーリング風ゲームを目指すAkashic Engine製のプロトタイプです。現在はゲームルールではなく、天体へドラッグで初速度を与え、多体重力による運動を表示する基礎部分を実装しています。

## 現在できること

- 3天体の重力シミュレーションと表示
- プレイヤー天体のドラッグによる初速度設定
- 6時間の固定物理タイムステップ
- Symplectic Euler / Velocity Verletの切り替え
- Akashic Engineに依存しない物理層の単体テスト

ステージ、スコア、勝敗、衝突、軌道予測、軌跡、早送り・一時停止UI、AIなどのゲームルールはまだ実装していません。

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
  rendering.ts            物理モデルからSpriteへの同期
  input_velocity.ts       ドラッグ量から初速度への変換
  universe*.ts            入力状態・時間進行・描画の調停
spec/                     単体・数値回帰・起動テスト
docs/                     設計文書
image/, audio/             既存アセット
```

## セットアップと実行

Node.jsを用意し、リポジトリ直下で次を実行します。

```sh
npm install
npm run build
npm start
```

Akashic Sandboxが表示するURLをブラウザで開いて動作を確認します。

## テストとlint

```sh
npm test
npm run lint
```

## 物理シミュレーション設定

設定は `src/setting.ts` に集約しています。

- `Setting.PhysicsStepSeconds`: 物理計算1回の時間。初期値は6時間（21,600秒）
- `Setting.SimulationSecondsPerSecond`: 実時間1秒あたりに進めるゲーム内時間。初期値は900日相当
- `Setting.IntegratorKind`: 使用する積分器
- `Setting.InputVelocityReferenceSeconds`: ドラッグ速度換算の基準時間。物理dtとは独立

積分器を変更するには `Setting.IntegratorKind` を次のいずれかへ変更します。

```ts
return PhysicsIntegratorKind.SymplecticEuler;
return PhysicsIntegratorKind.VelocityVerlet;
```

詳細な数式、更新順序、時間設定、拡張ポイントは [物理シミュレーション設計](docs/physics-simulation.md) を参照してください。

## 既知の制約

- 天体同士が同一位置になった場合、Newton重力の特異点となるため計算を停止します。
- 衝突判定と重力ソフトニングは未実装です。
- 6時間dtは現在の初期条件向けの既定値で、すべての軌道の精度を保証しません。
- シミュレーション速度が高いため、1画面更新で多数の固定ステップを実行します。
- 速度・重力ベクトルの表示は既存の簡易表示で、物理量を厳密な縮尺で描いてはいません。
