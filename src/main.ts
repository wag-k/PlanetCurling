import {Acceleration, Pos, Velocity} from "./motion";
import {PhysicalConstant} from "./physical_constant";
import {createPhysicsIntegrator} from "./physics_integrator";
import {PhysicsWorld} from "./physics_world";
import {Planet} from "./planet";
import {PlanetRenderer, PlanetView} from "./rendering";
import {Setting} from "./setting";
import {SimulationRunner} from "./simulation_runner";
import {Universe} from "./universe";

/**
 * PlanetCurlingのAkashic Sceneを構築し、入力・シミュレーション・描画を接続します。
 */
function main(_param: g.GameMainParameterObject): void {
	const scene: g.Scene = new g.Scene({
		game: g.game,
		assetIds: ["planet1", "planet2", "sun", "gravity_vector", "velocity_vector"]
	});
	const font: g.DynamicFont = new g.DynamicFont({
		game: g.game,
		fontFamily: "sans-serif",
		size: 48
	});

	scene.onLoad.add((): void => {
		const astronomicalUnit: number = PhysicalConstant.AstroUnit;
		const worldSpanMeters: number = 10 * astronomicalUnit;
		const playerPlanet: Planet = new Planet(
			40000,
			6 * Math.pow(10, 20),
			new Pos(4 * astronomicalUnit, 4 * astronomicalUnit),
			new Velocity(0, 0),
			new Acceleration(0, 0)
		);
		const secondaryPlanet: Planet = new Planet(
			40000,
			6 * Math.pow(10, 20),
			new Pos(7 * astronomicalUnit, 6 * astronomicalUnit),
			new Velocity(0, -0.003 * astronomicalUnit / Setting.InitialVelocityReferenceSeconds),
			new Acceleration(0, 0)
		);
		const sun: Planet = new Planet(
			40000,
			6 * Math.pow(10, 26),
			new Pos(6 * astronomicalUnit, 5 * astronomicalUnit),
			new Velocity(0, 0),
			new Acceleration(0, 0)
		);

		const world: PhysicsWorld = new PhysicsWorld([playerPlanet, secondaryPlanet, sun]);
		const runner: SimulationRunner = new SimulationRunner(
			world,
			createPhysicsIntegrator(Setting.IntegratorKind),
			Setting.PhysicsStepSeconds
		);
		const renderer: PlanetRenderer = new PlanetRenderer(scene, worldSpanMeters);
		const playerView: PlanetView = renderer.addPlanet(playerPlanet, "planet1", true);
		renderer.addPlanet(secondaryPlanet, "planet2");
		renderer.addPlanet(sun, "sun");

		const universe: Universe = new Universe(runner, renderer, worldSpanMeters, g.game.width);
		const directionLabel: g.Label = new g.Label({
			scene: scene,
			font: font,
			text: "プレイヤーをタッチして速度をつけよう",
			fontSize: 20,
			x: 10,
			y: 10
		});
		scene.append(directionLabel);

		scene.onUpdate.add((): void => {
			universe.update(1 / g.game.fps);
			scene.modified();
		});

		playerView.entity.onPointDown.add((): void => {
			directionLabel.text = "スワイプして方向を決めよう";
			directionLabel.invalidate();
			universe.state = universe.directionSelectState;
		});

		playerView.entity.onPointMove.add((event: g.PointMoveEvent): void => {
			directionLabel.text = "スワイプして方向を決めよう";
			directionLabel.invalidate();
			universe.playerDrag(event.startDelta.x, event.startDelta.y);
		});

		playerView.entity.onPointUp.add((): void => {
			universe.state = universe.motionSimulationState;
			directionLabel.text = "プレイヤーをタッチして速度をつけよう";
			directionLabel.invalidate();
		});
	});

	g.game.pushScene(scene);
}

export = main;
