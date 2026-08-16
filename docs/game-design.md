# PlanetCurlingゲーム設計

## Phase G4の目的

Phase G4では、G1～G3のターン、強い多体重力、得点・勝敗、軌道表示を維持し、投石同士の反発と中央天体への吸収を追加します。予測と本番に同じ衝突系を使い、ノックアウトをゲーム性として扱います。

## 決定済みルール

| 項目 | G4仕様 |
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
| Stone collision | 半径0.15 AU、反発係数0.9 |
| Central contact | 半径0.25 AU、投石を吸収して0点 |

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
  CollisionDetector / CollisionResolver / CollisionSystem
```

`CurlingStone`が所有者、投球番号、リリース状態、対応する`Planet`、`predictedTrajectory`、`actualTrajectory`を持ちます。軌跡はゲーム側メタデータであり、`Planet`にはRed/Blue、得点、軌跡を追加しません。`OrbitScoreEvaluator`、`TrajectoryPredictor`、`TrajectoryRecorder`もAkashic Engineに依存しません。

各ターンの開始時に速度0の新しいPlanetを共通発射位置へ生成し、PhysicsWorldへ追加します。投球済みPlanetは中央天体と他の投球惑星へ既存のNewton重力を及ぼします。中央天体へ吸収された場合だけPhysicsWorldから除外し、`CurlingStone`の所有者・履歴・軌跡はゲーム側へ残します。

## 衝突・ノックアウト

投石同士は質量差を考慮した円衝突として反発します。6時間dt中の開始位置と終了位置を使う連続判定により、高速ですれ違う場合も最初の接触を検出します。回転、摩擦、トルク、変形はG4に含めません。

中央天体へ接触した投石は吸収状態になります。物理世界と重力源から除外し、Spriteを非表示にし、得点は0です。実軌跡は接触位置を最終点として止まります。投石同士の衝突後は実軌跡を継続し、曲がった経路を残します。衝突と吸収は異なる色の短時間フラッシュで区別します。音と衝突半径のデバッグ表示は初期実装に含めません。

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

採点対象は`isReleased === true`かつ未吸収の投球だけです。照準中の`activeStone`は物理世界に存在していても得点へ含めず、吸収済み投石は常に0点です。

試合中のRed / Blue得点は、表示時点の中心天体と全リリース済み投球から再計算します。そのため、後続投球の重力で過去の投球や中心天体が動くと暫定得点も変化します。6投目の10年シミュレーション終了時に得点を確定し、次のいずれかを保存します。

- `RedWin`: Redの確定得点が高い
- `BlueWin`: Blueの確定得点が高い
- `Draw`: 確定得点が同じ

延長戦やタイブレークはG2に含めません。

## 描画

ターゲット軌道と得点帯の内外境界は、Akashic Engineの`FilledRect`を円周上へ配置した点線リングで描きます。リング群の親Entityを中心天体の最新位置へ毎フレーム同期するため、中心天体が移動しても追従します。外部描画ライブラリや新規画像アセットは使用しません。

## New Game

`New Game`はPhysicsWorld、SimulationRunner、投球数、得点、勝敗、全予測・実軌跡、予測入力キャッシュを消去します。新しい中央天体と未リリースのRed 1投目だけを生成し、ターゲット軌道の追従先も新しい中心天体へ切り替えます。

## Phase G5 UI・演出

Akashic非依存の`MatchController`がsimulation progressとStone score statusを提供し、`GameHudView`は物理・採点を行わず表示へ変換します。HUDはRed/Blue得点、turn、player shot / total shot、10年progress、各Stoneの得点・未投球・吸収状態を示します。値が変わったLabelだけをinvalidateします。

Aiming中のLaunch GuideはactiveStoneの実velocity方向（ドラッグと逆の実発射方向）を示し、長さだけを表示上clampします。物理velocityはclampしません。legacy gravity / velocity vectorは通常表示から除外しました。Prediction / Trails toggleは描画フラグだけを変更します。

Actual collisionだけがpresentation eventとなり、Stone–Stoneは`HIT!`、中央吸収はより大きい`ABSORBED!`と既存SEを一event一回表示・再生します。Prediction仮衝突は演出入口へ渡りません。予測は点線、actual trailは明瞭な実線として区別し、吸収点まで残します。終了時は盤面を背景に勝者・最終得点・Rematchを中央overlay表示し、Rematchは既存`newGame()`を再利用します。

## ロードマップ（G5完了時点）

- G1 Local turn-based match — DONE
- G2 Target orbit / score / result — DONE
- G3 Trajectory prediction / trail — DONE
- G4 Collision — DONE
- G4.1 Collision chronological fix — DONE
- G5 UI / effects / game balance — DONE
- G6 CPU
- G7 Simple online multiplayer
