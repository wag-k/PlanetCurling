import {GameBalance} from "./game_balance";
import {GameHudView} from "./game_hud_view";
import {CurlingStone, MatchController, MatchState, Player} from "./match_controller";
import {createPhysicsIntegrator} from "./physics_integrator";
import {PhysicsWorld} from "./physics_world";
import {LaunchGuideView, PlanetRenderer, PlanetView} from "./rendering";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";
import {Universe} from "./universe";

/** PlanetCurlingのScene構築とController / Renderer / HUDの接続だけを担当します。 */
function main(_param: g.GameMainParameterObject): void {
	const scene: g.Scene = new g.Scene({game: g.game, assetIds: ["planet1", "planet2", "sun", "se"]});
	const font: g.DynamicFont = new g.DynamicFont({game: g.game, fontFamily: "sans-serif", size: 40});

	scene.onLoad.add((): void => {
		const runner: SimulationRunner = new SimulationRunner(new PhysicsWorld(),
			createPhysicsIntegrator(Setting.IntegratorKind), Setting.PhysicsStepSeconds);
		const matchController: MatchController = new MatchController(runner);
		const renderer: PlanetRenderer = new PlanetRenderer(scene, GameBalance.WorldSpanMeters);
		const universe: Universe = new Universe(matchController, renderer, GameBalance.WorldSpanMeters, g.game.width);
		const guideLayer: g.E = new g.E({scene: scene});
		scene.append(guideLayer);
		const launchGuide: LaunchGuideView = new LaunchGuideView(scene, guideLayer,
			(): CurlingStone | undefined => matchController.state === MatchState.Aiming ? matchController.activeStone : undefined,
			GameBalance.WorldSpanMeters);
		const hud: GameHudView = new GameHudView(scene, font, matchController, renderer.trajectoryVisibility);

		/** activeStoneだけへドラッグ入力とreleaseを接続します。 */
		function bindStoneInput(stone: CurlingStone, view: PlanetView): void {
			view.entity.onPointMove.add((event: g.PointMoveEvent): void => {
				if (matchController.activeStone === stone) universe.playerDrag(event.startDelta.x, event.startDelta.y);
			});
			view.entity.onPointUp.add((): void => {
				if (matchController.activeStone === stone) universe.releaseActiveStone();
			});
		}

		/** 動的に生成されたStoneへ所有者色のViewと軌跡Viewを一度だけ追加します。 */
		function synchronizeStoneViews(): void {
			matchController.stones.forEach((stone: CurlingStone): void => {
				const existing: PlanetView | undefined = renderer.findView(stone.body);
				if (existing !== undefined) {
					existing.setVisible(!stone.isAbsorbed);
					return;
				}
				renderer.addStoneTrajectory(stone);
				const view: PlanetView = renderer.addPlanet(stone.body, stone.owner === Player.Red ? "planet1" : "planet2", true);
				view.setVisible(!stone.isAbsorbed);
				bindStoneInput(stone, view);
			});
		}

		/** New Game後も同じnewGame()を再利用して盤面Viewだけを再構築します。 */
		function rebuildPlanetViews(): void {
			renderer.clear();
			renderer.setTargetOrbit(matchController.centralBody);
			renderer.addPlanet(matchController.centralBody, "sun");
			synchronizeStoneViews();
			renderer.update();
		}

		hud.rematchButton.onPointDown.add((): void => {
			universe.newGame();
			rebuildPlanetViews();
		});
		rebuildPlanetViews();
		hud.update();
		scene.onUpdate.add((): void => {
			universe.update(1 / g.game.fps);
			synchronizeStoneViews();
			launchGuide.modified();
			hud.update();
			scene.modified();
		});
	});
	g.game.pushScene(scene);
}

export = main;
