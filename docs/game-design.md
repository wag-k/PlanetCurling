# PlanetCurlingゲーム設計

## Phase G4の目的

Phase G4では、G1～G3のターン、強い多体重力、得点・勝敗、軌道表示を維持し、投石同士の反発と中央天体への吸収を追加します。予測と本番に同じ衝突系を使い、ノックアウトをゲーム性として扱います。

## 決定済みルール

| 項目 | G4仕様 |
|---|---|
| Players | Local 2P: Red / Blue Human、Vs CPU: Red Human / Blue CPU |
| Ends per match | 2 |
| Shots per player / End | 3 |
| Turn order | End 1はRed先手、End 2はBlue先手で交互に投球 |
| Total shots | 12（6投 × 2 End） |
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

End 1の6投目のシミュレーション終了
  ↓ EndResultへscoreを固定
EndTransition
  ↓ NEXT END / board reset / Blue starts
Aiming (End 2)
  ↓ 6 shots
End 2 score confirmation / Match Total result decision
  ↓
MatchFinished
```

`Aiming`、`EndTransition`、`MatchFinished`では物理時間を進めません。`EndTransition`では終了済み盤面を表示し、`MatchFinished`では新しいPlanetを生成せず、投球入力も受け付けません。

## ゲーム進行層と物理層の境界

```text
Game
  MatchController
    Player / MatchState / EndResult / MatchResult
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

各ターンの開始時に速度0の新しいPlanetを共通発射位置へ生成し、PhysicsWorldへ追加します。同じエンドの投球済みPlanetは中央天体と他の投球惑星へ既存のNewton重力を及ぼします。中央天体へ吸収された場合だけPhysicsWorldから除外し、`CurlingStone`の所有者・履歴・軌跡はそのエンドの終了までゲーム側へ残します。

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

実軌跡も10ゲーム日ごとにsampleします。同じエンドの後続投球の10年シミュレーション中も過去の全投球を記録し続けるため、相互重力で変化する経路が延長されます。エンド間では全軌跡を消去します。Aiming、EndTransition、MatchFinishedでは固定物理ステップが発生せず、同一位置を重複追加しません。

投球直後は同じ盤面、速度、積分器、dt、期間なので予測と実際は一致します。一方、過去投球の予測時には後続惑星が存在しなかったため、試合が進むと実軌跡が保存済み予測から外れる場合があります。これは正常であり、PlanetCurlingの多体重力によるゲーム性です。

描画は1点につき1 Entityを作らず、1投につき1つの`StoneTrajectoryView`が全点を直接描きます。予測は所有者色の点線、実軌跡は所有者色の実線です。表示対象は現在エンドの最大6投分です。

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

現在エンドのRed / Blue得点は、表示時点の中心天体とそのエンドの全リリース済み投球から再計算します。そのため、同じエンドの後続投球の重力で過去の投球や中心天体が動くと暫定得点も変化します。各エンドの6投目の10年シミュレーション終了時に得点を`EndResult`へ固定し、2つの`EndResult`の合計から次の勝敗を保存します。

- `RedWin`: Redの確定得点が高い
- `BlueWin`: Blueの確定得点が高い
- `Draw`: 確定得点が同じ

同点時の延長戦やタイブレークはG6.2に含めません。

## 描画

ターゲット軌道と得点帯の内外境界は、Akashic Engineの`FilledRect`を円周上へ配置した点線リングで描きます。リング群の親Entityを中心天体の最新位置へ毎フレーム同期するため、中心天体が移動しても追従します。外部描画ライブラリや新規画像アセットは使用しません。

## New Game

`New Game`はPhysicsWorld、SimulationRunner、投球数、全`EndResult`、得点、勝敗、全予測・実軌跡、予測入力キャッシュを消去します。End 1へ戻し、新しい中央天体と未リリースのRed 1投目だけを生成して、ターゲット軌道の追従先も新しい中心天体へ切り替えます。

## Phase G5 UI・演出

Akashic非依存の`MatchController`がsimulation progressとStone score statusを提供し、`GameHudView`は物理・採点を行わず表示へ変換します。HUDはMatch Total、現在End得点、End番号、turn、player shot / End throw、10年progress、各Stoneの得点・未投球・吸収状態を示します。値が変わったLabelだけをinvalidateします。

Aiming中のLaunch GuideはactiveStoneの実velocity方向（ドラッグと逆の実発射方向）を示し、長さだけを表示上clampします。物理velocityはclampしません。legacy gravity / velocity vectorは通常表示から除外しました。Prediction / Trails toggleは描画フラグだけを変更します。

Actual collisionだけがpresentation eventとなり、Stone–Stoneは`HIT!`、中央吸収はより大きい`ABSORBED!`と既存SEを一event一回表示・再生します。Prediction仮衝突は演出入口へ渡りません。予測は点線、actual trailは明瞭な実線として区別し、吸収点まで残します。終了時は盤面を背景に勝者・最終得点・Rematchを中央overlay表示し、Rematchは既存`newGame()`を再利用します。

## Phase G5.1 Mobile / Tablet Support

Akashic内部は従来どおり1280×720の固定論理解像度です。`ResponsiveLayout`は物理device viewportからDesktop Landscape、Compact Landscape、Portraitを判定しますが、変更するのはView・HUD・入力用矩形だけです。物理座標、得点、collision radius、launch換算、trajectory samplingは参照も変更もしません。

論理画面の左720×720を正方形のGame Board、右560×720をHUDとして分離しました。HUDにはScore、Turn、Shot、Simulation Progress、Stone Status、Prediction / Trails toggleを短い文言で縦に配置します。結果overlayはHUDではなく盤面中央へ収め、Rematchは260×80、通常toggleも高さ72～80のtouchable背景全体を入力対象にします。

Stone Spriteの見た目と入力を分離し、Aiming中のactiveStoneだけ112～128px角の透明touch targetを表示します。targetはStoneを追従し、盤面境界内へclampします。過去Stoneと吸収Stoneでは非表示のため操作できません。ドラッグの論理量からlaunch velocityへの換算式は従来どおりです。

Compact modeではLaunch GuideをStoneから離して長く太く描き、endpoint markerを追加します。Prediction dot、Actual Trail、Target Orbit dotも論理描画寸法だけを大きくします。予測期間、sample間隔、target radius、score thresholdは変更しません。

Smartphone landscapeとtablet landscapeを正式サポートします。phone portraitでは`Please rotate your device` overlayが入力を受け止め、landscapeへ戻ると消えます。tablet portraitでは操作を残した小さな案内だけを表示します。

GitHub Pages成果物は`akashic-cli-export-html --magnify`でbrowser viewportへfitさせます。`export/mobile-support.html`をexporterの`--inject`で毎回追加し、既存viewport metaへ`viewport-fit=cover`を設定します。CSSのsafe-area inset、`touch-action: none`、`overscroll-behavior: none`は再exportやGitHub Actionsでも同じ結果になります。FullscreenとPWA化は対象外です。

## Phase G6 CPU opponent

`GameSessionConfig`は物理層から独立して`LocalTwoPlayer` / `VsCpu`と`Easy` / `Normal` / `Hard`を保持します。起動時overlayで選択し、Rematchでは同じ値を維持します。Vs CPUはRedをHuman、BlueをCPUに固定し、Blue Aiming中は大型透明touch targetを含むStone入力を無効化します。`MatchController`は従来どおりTurn、Stone、Score、MatchState、Physics progressionだけを管理し、CPU判断を持ちません。

CPUは現在のBlue Aiming盤面だけを見る1-ply searchです。minimaxや後続Human shot予測、乱数、scripted shotは使いません。

```text
current Blue Aiming PhysicsWorld
  ↓ polar virtual drag candidates (all 360 degrees)
  ↓ calculateLaunchVelocity() shared with Human
PhysicsWorld.cloneWithMapping()
  ↓ CollisionSystem.cloneForWorld()
same Integrator / same 6-hour base dt / exact 10 game years
  ↓ final board only (no TrajectoryPoint[] per candidate)
CpuBoardEvaluator
  ↓ global best local refinement
best velocity → existing setActiveStoneVelocity()
  ↓ existing TrajectoryPredictor / 15-frame preview
existing releaseActiveStone()
```

候補gridはEasyが12方向×3速度=36件でrefinementなし、Normalが16×4=64件とglobal best周辺3×3（中心重複を除き合計72件）、Hardが24×5=120件と5×5（合計144件）です。virtual dragは0超300 logical px以下で、物理dtや人間入力自体をclampしません。局所gridが範囲端へ来た場合はgrid全体を内側へずらし、候補数と範囲を維持します。

10年後の全リリース済みStoneと今回のactive Stoneを`OrbitScoreEvaluator`で再採点します。吸収されclone世界から削除されたStoneは0点です。連続軌道品質は次式をStoneごとに求めて合計します。

```text
orbitQuality = clamp(1 - effectiveOrbitError / OnePointOrbitError, 0, 1)

utility = 1000 × (cpuScore - humanScore)
        +   60 × (cpuOrbitQuality - humanOrbitQuality)
        +  120 × newlyAbsorbedHumanCount
        -  120 × newlyAbsorbedCpuExistingCount
        -  180 × activeCpuStoneAbsorbed
```

同utility時は、active CPU Stone得点、CPU合計得点、Human合計得点の低さ、launch speedの小ささ、angleの小ささの順で決定します。探索とtie-breakは決定論的です。自己吸収はpenaltyですが絶対禁止ではないため、相手高得点Stoneを落として得点差が改善する自己犠牲は選択可能です。

`CpuPlanningSession.step(1)`が1frameに1candidateだけをclone simulationし、HUDへ`CPU THINKING n / total`を表示します。MatchStateはAimingのまま、アプリケーション側`CpuTurnState`がIdle / Planning / Previewingを管理します。best決定後だけ既存TrajectoryPredictorを呼び、15frameの`CPU READY`表示後に通常releaseします。CPU候補と実投球は同じSimulationRunner・CollisionSystem経路なので、Stone衝突、Chronological TOI、multiple collision、中央吸収も一致します。

## Phase G6.1 How to Play / Rules UI

Mode Selectionの`HOW TO PLAY`とGame HUDの`RULES`は、同一の`RulesOverlayView`を開きます。`RulesContent`はAkashic描画から分離した`RulePage` / `RuleSection` / `RuleLine`を持ち、将来の翻訳や文言変更でViewを作り直しません。

4ページの責務は次のとおりです。

- **MATCH FORMAT**: 2 End、各3投、先後交代、エンド間盤面reset、Match Total
- **GOAL & SCORE**: 得点帯、位置と動径速度、2 AU targetと包含閾値
- **HOW TO PLAY**: drag、launch guide、prediction、release、10年simulation、残留Planetの多体重力、Dotted / Solid
- **COLLISIONS & TACTICS**: opponentへの衝突、Sun吸収、攻撃・防御、Vs CPUの色と探索精度

得点説明のtarget radius、velocity reference、0.20 / 0.50 / 1.00 AU閾値は`OrbitScoreEvaluator`の現在値を`PhysicalConstant.AstroUnit`と`Setting.SecondsPerYear`で表示変換します。Rules専用の得点定数は持ちません。

`RulesOverlayState`はpage navigationと表示状態だけを所有し、`RulesInteractionGate`がその`isVisible`を参照します。表示中は1frameの`Universe.update()`と`CpuTurnController.update()`をまとめてskipするため、Simulating、TurnTransition、CPU Planning、CPU Previewを同じstateのまま停止します。Human Stone入力とHUD操作も同じgateを通し、全画面touchable背景を入力の最終防壁にします。CLOSE時にMatchStateやCpuPlanningSessionを変更しないため、その続きから再開します。

`ResponsiveLayout`はRules panel、本文、CLOSE、PREV、NEXT、page indicator、Mode Selection / HUD入口を論理画面内へ収めます。pageを分割し、Compact Landscapeでもtouch targetを64 logical px以上に保ちます。

## Phase G6.2 2 End制・先後交代

`MatchController`は各エンドの現在盤面得点と、終了済みエンドだけを合計するMatch Totalを明確に分離します。End 1は`Red → Blue → Red → Blue → Red → Blue`、End 2は`Blue → Red → Blue → Red → Blue → Red`です。第6投のシミュレーション完了時に`EndResult(endNumber, startingPlayer, lastPlayer, redScore, blueScore)`を生成し、以後の物理状態から独立した値として保持します。

End 1後の`EndTransition`から`NEXT END`を実行すると、`PhysicsWorld`、中央天体、CollisionSystem、Stone、吸収状態、予測・実軌跡、投球カウンタを完全に初期化します。確定済み`EndResult`だけを維持し、End 2のBlue 1投目を生成します。CPU探索ロジックと候補評価は変更せず、Vs CPUのBlue Aiming検出によりEnd 2開始直後から通常どおり探索します。

最終overlayはEnd 1、End 2、Match Totalを表形式で表示します。Rematchは全エンド履歴を消してEnd 1へ戻り、Change Modeは従来どおりMode Selectionを表示します。

## ロードマップ（G6.2完了時点）

- G1 Local turn-based match — DONE
- G2 Target orbit / score / result — DONE
- G3 Trajectory prediction / trail — DONE
- G4 Collision — DONE
- G4.1 Collision chronological fix — DONE
- G5 UI / effects / game balance — DONE
- G5.1 Mobile / Tablet support — DONE
- G6 CPU opponent — DONE
- G6.1 How to Play / Rules UI — DONE
- G6.2 2 Ends / alternating starts — DONE
- G7 Simple online multiplayer
