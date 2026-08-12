import {GameBalance} from "./game_balance";
import {CurlingStone, MatchController, MatchState, Player} from "./match_controller";
import {createPhysicsIntegrator} from "./physics_integrator";
import {PhysicsWorld} from "./physics_world";
import {PlanetRenderer, PlanetView} from "./rendering";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";
import {Universe} from "./universe";

/**
 * PlanetCurlingのAkashic Sceneを構築し、2人対戦の入力・ターン進行・描画を接続します。
 */
function main(_param: g.GameMainParameterObject): void {
	const scene: g.Scene = new g.Scene({
		game: g.game,
		assetIds: ["planet1", "planet2", "sun", "gravity_vector", "velocity_vector"]
	});
	const font: g.DynamicFont = new g.DynamicFont({
		game: g.game,
		fontFamily: "sans-serif",
		size: 32
	});

	scene.onLoad.add((): void => {
		const runner: SimulationRunner = new SimulationRunner(
			new PhysicsWorld(),
			createPhysicsIntegrator(Setting.IntegratorKind),
			Setting.PhysicsStepSeconds
		);
		const matchController: MatchController = new MatchController(runner);
		const renderer: PlanetRenderer = new PlanetRenderer(scene, GameBalance.WorldSpanMeters);
		const universe: Universe = new Universe(
			matchController,
			renderer,
			GameBalance.WorldSpanMeters,
			g.game.width
		);

		const turnLabel: g.Label = new g.Label({
			scene: scene,
			font: font,
			text: "",
			fontSize: 22,
			x: 10,
			y: 10
		});
		const stateLabel: g.Label = new g.Label({
			scene: scene,
			font: font,
			text: "",
			fontSize: 20,
			x: 10,
			y: 42
		});
		const newGameButton: g.FilledRect = new g.FilledRect({
			scene: scene,
			cssColor: "#303030",
			x: g.game.width - 180,
			y: 10,
			width: 160,
			height: 48,
			touchable: true
		});
		const newGameLabel: g.Label = new g.Label({
			scene: scene,
			font: font,
			text: "New Game",
			fontSize: 20,
			x: g.game.width - 155,
			y: 22
		});

		/** 現在の試合状態を画面上のターン情報へ反映します。 */
		function updateLabels(): void {
			const playerText: string = matchController.currentPlayer === Player.Red ? "RED" : "BLUE";
			turnLabel.text = matchController.state === MatchState.MatchFinished
				? "Total: 6 / 6"
				: "Turn: " + playerText
					+ "  Shot: " + matchController.getCurrentPlayerShotNumber() + " / " + matchController.shotsPerPlayer
					+ "  Total: " + matchController.getCurrentTotalShotNumber() + " / " + matchController.maximumTotalShots;
			if (matchController.state === MatchState.Aiming) {
				stateLabel.text = "Aim and release";
			} else if (matchController.state === MatchState.Simulating) {
				stateLabel.text = "Simulating...";
			} else if (matchController.state === MatchState.TurnTransition) {
				stateLabel.text = "Next turn...";
			} else {
				stateLabel.text = "Match Finished";
			}
			turnLabel.invalidate();
			stateLabel.invalidate();
		}

		/** 指定した駒のViewへ、その駒がactiveStoneの場合だけ有効になる入力を接続します。 */
		function bindStoneInput(stone: CurlingStone, view: PlanetView): void {
			view.entity.onPointDown.add((): void => {
				if (matchController.state === MatchState.Aiming && matchController.activeStone === stone) {
					stateLabel.text = "Swipe to choose direction";
					stateLabel.invalidate();
				}
			});
			view.entity.onPointMove.add((event: g.PointMoveEvent): void => {
				if (matchController.activeStone === stone) {
					universe.playerDrag(event.startDelta.x, event.startDelta.y);
				}
			});
			view.entity.onPointUp.add((): void => {
				if (matchController.activeStone === stone && universe.releaseActiveStone()) {
					updateLabels();
				}
			});
		}

		/** 物理世界へ動的追加された投球駒に、所有者別の既存画像Viewを追加します。 */
		function synchronizeStoneViews(): void {
			matchController.stones.forEach((stone: CurlingStone): void => {
				if (renderer.findView(stone.body) !== undefined) {
					return;
				}
				const imageAssetId: string = stone.owner === Player.Red ? "planet1" : "planet2";
				bindStoneInput(stone, renderer.addPlanet(stone.body, imageAssetId, true));
			});
		}

		/** New Game後の新しい物理モデルに合わせて全Viewを作り直します。 */
		function rebuildPlanetViews(): void {
			renderer.clear();
			renderer.addPlanet(matchController.centralBody, "sun");
			synchronizeStoneViews();
			renderer.update();
		}

		newGameButton.onPointDown.add((): void => {
			universe.newGame();
			rebuildPlanetViews();
			updateLabels();
		});

		rebuildPlanetViews();
		scene.append(turnLabel);
		scene.append(stateLabel);
		scene.append(newGameButton);
		scene.append(newGameLabel);
		updateLabels();

		scene.onUpdate.add((): void => {
			universe.update(1 / g.game.fps);
			synchronizeStoneViews();
			updateLabels();
			scene.modified();
		});
	});

	g.game.pushScene(scene);
}

export = main;
