# PlanetCurlingゲーム設計

## Phase G1の目的

Phase G1では得点や衝突より先に、2人が同じ画面で交互に投球できるゲーム進行を成立させます。既存のAkashic非依存物理層、6時間固定dt、積分器、描画分離を維持し、その上へ試合進行層を追加します。

## 決定済みルール

| 項目 | G1仕様 |
|---|---|
| Players | Red / Blue（ローカル2人対戦） |
| Shots per player | 3 |
| Turn order | RedとBlueが交互に投球 |
| Total shots | 6 |
| Simulation after shot | 固定5ゲーム年（1年は365日） |
| Physics step | 6時間固定 |
| Aiming | 物理時間を停止 |
| Central body | 固定せず通常の動的な物理天体 |
| Stone mutual gravity | 現実の小天体より意図的に強い暫定質量 |

状態は次の順で遷移します。

```text
Aiming
  ↓ release
Simulating
  ↓ fixed 5 game years
TurnTransition
  ↓
Aiming

6投目のシミュレーション終了
  ↓
MatchFinished
```

`Aiming`と`MatchFinished`では物理時間を進めません。`MatchFinished`では新しいPlanetを生成せず、入力も受け付けません。

## ゲーム進行層と物理層の境界

```text
Game
  MatchController
    Player
    MatchState
    CurlingStone
    activeStone

Physics
  Planet
  PhysicsWorld
  Gravity
  PhysicsIntegrator
  SimulationRunner
```

`CurlingStone`が所有者、所有者ごとの投球番号、対応する`Planet`を持ちます。`Planet`にはRed/Blueやターン状態を追加しません。`MatchController`は物理配列のindexではなく`activeStone`を明示的に保持するため、過去のPlanetを再操作できません。

各ターンの開始時に速度0の新しいPlanetを共通発射位置へ生成し、PhysicsWorldへ追加します。投球済みPlanetは削除しないため、中央天体とすべての投球惑星が互いに既存のNewton重力を及ぼします。

中央天体も通常の`Planet`であり、位置固定や速度の強制リセットは物理ステップ中に行いません。他の天体から重力を受け、積分器によって位置と速度が更新されます。

## 固定時間シミュレーション

1投の時間は次の設定で管理します。

```text
SimulationDurationPerShotSeconds = 5 × 365日
PhysicsStepSeconds = 6時間
Steps per shot = 7300
```

`MatchController`は完了した固定ステップの時間と`SimulationRunner`のaccumulator端数を追跡します。最後のフレームでは5年の境界までしか時間を渡さず、余分な1フレーム分を進めません。5年は6時間の整数倍なので、ターン終了時にaccumulatorは0になります。

## 暫定ゲームバランス

| 設定 | 暫定値 |
|---|---:|
| `GameBalance.CentralBodyMassKg` | `6 × 10^26 kg` |
| `GameBalance.StoneMassKg` | `6 × 10^24 kg` |
| 質量比 | 1% |
| 共通発射位置 | `(4 AU, 4 AU)` |
| 中央天体初期位置 | `(6 AU, 5 AU)` |

投球惑星の質量は、現実的な小惑星より意図的に大きいG1用の暫定値です。近接時に投球惑星同士の引力を認識可能にしながら、中央天体の質量を100倍として主な軌道形成要因にします。特殊な疑似重力、距離補正、天体別の万有引力定数は使いません。

## New Game

右上の`New Game`操作は次を行います。

1. PhysicsWorldから既存の中央天体と投球惑星をすべて削除する。
2. SimulationRunnerのaccumulatorとステップ数をリセットする。
3. 新しい中央天体を初期位置・速度0で追加する。
4. Red / Blueの投球数を0へ戻す。
5. Redの1投目を生成して`Aiming`へ戻す。
6. 古いViewを破棄し、新しい物理モデルに対応するViewを再生成する。

## 今後予定

1. ターゲット軌道・得点
2. 軌道予測・軌跡
3. 衝突
4. UI/演出・バランス調整
5. CPU
6. 簡易ネット対戦

これらはPhase G1のスコープ外であり、現在は実装していません。
