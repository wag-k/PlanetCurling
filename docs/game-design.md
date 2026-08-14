# PlanetCurlingゲーム設計

## Phase G3の目的

Phase G3では、G1/G2のターン、強い多体重力、得点・勝敗を維持し、照準中の10年軌道予測と投球後の実軌跡を追加します。予測と実際の違いを可視化し、後続惑星による軌道変化をゲーム性として扱います。

## 決定済みルール

| 項目 | G3仕様 |
|---|---|
| Players | Red / Blue（ローカル2人対戦） |
| Shots per player | 3 |
| Turn order | RedとBlueが交互に投球 |
| Total shots | 6 |
| Simulation after shot | 固定10ゲーム年（1年は365日） |
| Physics step | 6時間固定 |
| Launch velocity | 既存基準速度の1.5倍 |
| Target orbit | 現在の中心天体から半径2 AU |
| Score | 1投0～3点、1人最大9点 |
| Aiming | 物理時間を停止 |
| Central body | 固定せず通常の動的な物理天体 |
| Prediction | 現在盤面をcloneし、本番と同じ物理で10年 |
| Trajectory sample | 10ゲーム日ごと |
| Display | 点線=予測、実線=実軌跡 |

状態は次の順で遷移します。

```text
Aiming
  ↓ release（isReleased = true）
Simulating
  ↓ fixed 10 game years
TurnTransition
  ↓
Aiming

6投目のシミュレーション終了
  ↓ score confirmation / result decision
MatchFinished
```

`Aiming`と`MatchFinished`では物理時間を進めません。`MatchFinished`では新しいPlanetを生成せず、入力も受け付けません。

## ゲーム進行層と物理層の境界

```text
Game
  MatchController
    Player / MatchState / MatchResult
    CurlingStone / isReleased
    provisional and confirmed scores
  OrbitScoreEvaluator
    OrbitEvaluation
  TrajectoryPredictor
  TrajectoryRecorder
  TrajectoryPoint

Physics
  Planet
  PhysicsWorld
  Gravity
  PhysicsIntegrator
  SimulationRunner
```

`CurlingStone`が所有者、投球番号、リリース状態、対応する`Planet`、`predictedTrajectory`、`actualTrajectory`を持ちます。軌跡はゲーム側メタデータであり、`Planet`にはRed/Blue、得点、軌跡を追加しません。`OrbitScoreEvaluator`、`TrajectoryPredictor`、`TrajectoryRecorder`もAkashic Engineに依存しません。

各ターンの開始時に速度0の新しいPlanetを共通発射位置へ生成し、PhysicsWorldへ追加します。投球済みPlanetは削除しないため、中央天体とすべての投球惑星が互いに既存のNewton重力を及ぼします。

## 固定時間と発射速度

```text
SimulationDurationPerShotSeconds = 10 × 365日
PhysicsStepSeconds = 6時間
Steps per shot = 14600
LaunchVelocityMultiplier = 1.5
```

`MatchController`は完了した固定ステップの時間と`SimulationRunner`のaccumulator端数を追跡し、10年の境界より先へ進めません。10年は6時間の整数倍なので、ターン終了時にaccumulatorは0になります。

発射速度倍率はドラッグ量から既存基準速度を求めた後に掛けます。物理dtは入力変換に使わないため、6時間固定dtとは独立しています。

## 軌道予測

照準中のドラッグ速度が表示thresholdを超えると、次の流れで予測します。

```text
current PhysicsWorld
  ↓ PhysicsWorld.cloneWithMapping()
deep-cloned PhysicsWorld + source body mapping
  ↓ activeStone.bodyに対応するcloneへ仮速度
same IntegratorKind / 6-hour physics dt / 10 game years
  ↓ sample every 10 game days
TrajectoryPoint[]
```

`Planet.clone()`がmass、radius、position、velocity、accelerationをdeep cloneします。`PhysicsWorldClone`は元の天体参照からclone側天体を取得する対応を保持し、物理配列indexへ`activeStone`というゲーム上の意味を暗黙に持たせません。予測はclone側だけを進めるため、本番世界の位置・速度・加速度へ副作用を与えません。

予測期間は本番1投と同じ10年、積分器種別も本番設定と同一です。物理計算は6時間dtの14,600ステップを省略せず、描画点だけを10日間隔の開始点込み366点へsamplingします。

ドラッグ中は、同じ入力または4px未満の入力変化について再計算を抑えます。これは表示計算のキャッシュであり、実際に設定する投球速度は丸めません。盤面が変わる次のactiveStoneやNew Gameではキャッシュを無効化します。

## 実軌跡と予測比較

リリース時に最後に表示されていた予測を`CurlingStone.predictedTrajectory`へ保存し、`actualTrajectory`を投球位置から開始します。`SimulationRunner`は各固定ステップ完了後に任意コールバックを呼び、`MatchController`が全リリース済み投球の`TrajectoryRecorder`を進めます。記録責務は積分器へ追加していません。

実軌跡も10ゲーム日ごとにsampleします。後続投球の10年シミュレーション中も過去の全投球を記録し続けるため、相互重力で変化する経路が延長されます。AimingとMatchFinishedでは固定物理ステップが発生せず、同一位置を重複追加しません。

投球直後は同じ盤面、速度、積分器、dt、期間なので予測と実際は一致します。一方、過去投球の予測時には後続惑星が存在しなかったため、試合が進むと実軌跡が保存済み予測から外れる場合があります。これは正常であり、PlanetCurlingの多体重力によるゲーム性です。

描画は1点につき1 Entityを作らず、1投につき1つの`StoneTrajectoryView`が全点を直接描きます。予測は所有者色の点線、実軌跡は所有者色の実線です。最大Entity数は6投分に抑えます。

## ターゲット軌道と得点

ターゲット軌道は、ワールド座標に固定せず、現在の中心天体から半径2 AUの円として扱います。投球惑星と中心天体について次を計算します。

```text
relativePosition = stone.position - central.position
relativeVelocity = stone.velocity - central.velocity
r = |relativePosition|
radialDistanceError = |r - targetRadius|
radialVelocity = dot(relativeVelocity, relativePosition) / r
effectiveOrbitError = radialDistanceError
                    + |radialVelocity| × ScoreVelocityReferenceSeconds
```

`ScoreVelocityReferenceSeconds`は1ゲーム年です。動径速度が0に近いほど、円軌道の半径を維持しやすい状態として高く評価します。接線方向速度そのものや軌道要素の完全一致はG2では判定しません。

| 実効軌道誤差 | 得点 |
|---:|---:|
| 0.20 AU以下 | 3 |
| 0.50 AU以下 | 2 |
| 1.00 AU以下 | 1 |
| 1.00 AU超 | 0 |

境界値は上側を含みます。画面の同心円は位置誤差だけを表すため、見た目がリング内でも動径速度が大きければ得点は下がります。

## 暫定得点と勝敗

採点対象は`isReleased === true`の投球だけです。照準中の`activeStone`は物理世界に存在していても得点へ含めません。

試合中のRed / Blue得点は、表示時点の中心天体と全リリース済み投球から再計算します。そのため、後続投球の重力で過去の投球や中心天体が動くと暫定得点も変化します。6投目の10年シミュレーション終了時に得点を確定し、次のいずれかを保存します。

- `RedWin`: Redの確定得点が高い
- `BlueWin`: Blueの確定得点が高い
- `Draw`: 確定得点が同じ

延長戦やタイブレークはG2に含めません。

## 描画

ターゲット軌道と得点帯の内外境界は、Akashic Engineの`FilledRect`を円周上へ配置した点線リングで描きます。リング群の親Entityを中心天体の最新位置へ毎フレーム同期するため、中心天体が移動しても追従します。外部描画ライブラリや新規画像アセットは使用しません。

## New Game

`New Game`はPhysicsWorld、SimulationRunner、投球数、得点、勝敗、全予測・実軌跡、予測入力キャッシュを消去します。新しい中央天体と未リリースのRed 1投目だけを生成し、ターゲット軌道の追従先も新しい中心天体へ切り替えます。

## ロードマップ

- Phase G1: ローカル2人対戦・ターン進行（完了）
- Phase G2: プレイ調整・ターゲット軌道・得点・勝敗（完了）
- Phase G3: 軌道予測・実軌跡（完了）
- Phase G4: 衝突
- Phase G5: UI・演出・バランス調整
- Phase G6: CPU対戦
- Phase G7: 簡易オンライン対戦

G4以降の衝突、CPU/AI、ネット対戦、難易度選択、ランキング、ステージ制、タイブレークはG3のスコープ外です。
