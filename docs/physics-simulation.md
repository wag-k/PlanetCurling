# 物理シミュレーション設計

## 責務の流れ

```mermaid
flowchart TD
    Input["Input<br/>Akashicのドラッグ入力"] --> Simulation["Simulation<br/>実時間をゲーム内時間へ換算"]
    Simulation --> Runner["SimulationRunner<br/>accumulatorと固定dt"]
    Runner --> Integrator["Physics Integrator<br/>Symplectic Euler / Velocity Verlet"]
    Integrator --> Model["Physics Model<br/>PhysicsWorld / Planet"]
    Model --> Renderer["Renderer<br/>モデルからViewへ同期"]
    Renderer --> Akashic["Akashic Engine<br/>Scene / Sprite"]
```

`Planet`、`PhysicsWorld`、重力計算、積分器、`SimulationRunner` は `g.Scene` や `g.Sprite` を参照しません。描画依存は `PlanetView` と `PlanetRenderer` が引き受けます。これにより、物理層をAkashic Engineなしで単体テストできます。

## 単位系

物理層は原則としてSI単位系を使用します。

- 位置・半径: m
- 質量: kg
- 時間: s
- 速度: m/s
- 加速度: m/s²
- 万有引力定数: m³ kg⁻¹ s⁻²

pxへの変換は `rendering.ts` だけで行い、物理モデルへpxを保存しません。

## Newtonの万有引力

天体 `i` が天体 `j` から受ける加速度は次式です。

```text
a_i,j = G * m_j / |r_j - r_i|^3 * (r_j - r_i)
```

`calculateAccelerations(bodies)` は、ある同一時刻の全位置を読み取って全加速度をまとめて返します。積分器は天体を順番に完全更新しないため、更新済み位置と更新前位置が同じ重力評価に混在しません。

同じ位置にある異なる天体間では式が特異になるため、現在は例外にします。衝突判定や重力ソフトニングは意図的に追加していません。

## 固定タイムステップ

`Setting.PhysicsStepSeconds` の初期値は6時間、つまり21,600秒です。物理dtを固定すると、描画fpsの揺れによって積分精度や軌道が変わることを避けやすく、同じ入力に対する再現性も高まります。

`SimulationRunner.advance(simulationSeconds)` は渡されたゲーム内時間をaccumulatorへ加算します。accumulatorが固定dt以上の間だけ `integrator.step()` を繰り返し、固定dt未満の端数は次回へ保持します。たとえば30日は次の120ステップです。

```text
30 days / 6 hours = 120 steps
```

## 描画周期との分離

Akashicの更新周期は実時間ベース、物理積分はゲーム内時間ベースです。1フレームの処理順は次のとおりです。

```text
Akashic update
  -> 実時間をゲーム内時間へ換算
  -> 0回以上の固定物理step
  -> PlanetRenderer.update()を1回
```

6時間ごとのサブステップではSpriteを操作しません。初期の `Setting.SimulationSecondsPerSecond` は実時間1秒で900日分であり、30fpsでは従来と同じく1フレームあたり約30日進みます。物理dtと見た目の進行速度は別設定です。

## Symplectic Euler

`SymplecticEulerIntegrator` は次の順で更新します。

1. 現在位置から全天体の `a(t)` を計算する
2. 全天体の速度を `v(t+dt) = v(t) + a(t) dt` で更新する
3. 更新後の全速度で位置を `x(t+dt) = x(t) + v(t+dt) dt` と更新する

通常の陽的Euler法より軌道問題の長期的な性質を保ちやすく、計算量も比較的小さい方式です。本プロジェクトでは既存挙動との連続性のため既定値にしています。

## Velocity Verlet

`VelocityVerletIntegrator` は次の順で更新します。

1. 現在位置から全天体の `a(t)` を計算する
2. 全天体の位置を `x(t+dt) = x(t) + v(t)dt + 0.5 a(t)dt²` で更新する
3. 更新後の全位置から全天体の `a(t+dt)` を再計算する
4. 全天体の速度を `v(t+dt) = v(t) + 0.5(a(t)+a(t+dt))dt` で更新する

位置を2次精度で扱い時間対称性を持つ一方、1ステップで重力を2回評価します。どの条件でも必ずSymplectic Eulerより良いとは限りません。

## 積分器の切り替え

`src/setting.ts` の `Setting.IntegratorKind` を変更します。

```ts
static get IntegratorKind(): PhysicsIntegratorKind {
    return PhysicsIntegratorKind.VelocityVerlet;
}
```

どちらの積分器も同じ `IPhysicsIntegrator.step(world, dt)` と `PhysicsWorld` を使用します。実行中の切り替えが必要になった場合は `SimulationRunner.setIntegrator()` を使用できますが、今回は切り替えUIを提供しません。

## 時間設定の変更

- 物理精度・計算量を変える: `Setting.PhysicsStepSeconds`
- 見た目の時間進行速度を変える: `Setting.SimulationSecondsPerSecond`

両者は独立しています。物理dtを小さくすると同じゲーム内時間を進めるステップ数が増えます。シミュレーション速度だけを上げても固定dtは変化しません。

## ドラッグ速度の分離

ドラッグ量から初速度への換算は `calculateLaunchVelocity()` が担当します。換算には `Setting.InputVelocityReferenceSeconds` と `Setting.DragVelocityDivisor` を使い、最後に `Setting.LaunchVelocityMultiplier`（現在は1.5）を掛けます。`PhysicsStepSeconds` は参照しないため、物理dtを変更しても操作感が直接変化しません。

## 将来の拡張ポイント

- 軌道予測: `PhysicsWorld` を複製し、選択中の積分器と固定dtで別の `SimulationRunner` を進める
- 早送り・低速化: `SimulationSecondsPerSecond` 相当のランタイム倍率をSimulation層へ追加する
- 一時停止: `advance()` に渡すゲーム内時間を0にする
- 描画補間: accumulatorの割合をView用に使い、物理状態を変更せず補間表示する
- 衝突: 固定ステップごとの物理処理としてIntegrator外側へ衝突解決フェーズを追加する

これらは拡張点の説明であり、現時点では実装していません。

## 数値誤差とdtの限界

数値積分には打ち切り誤差と浮動小数点誤差があります。6時間dtは現時点の初期値であり、近接遭遇、高速運動、質量比の異なるあらゆる軌道条件に十分な精度を保証するものではありません。条件を変更した場合は、エネルギー誤差、軌道の発散、NaN/Infinityの有無を回帰テストまたは診断で確認してください。
