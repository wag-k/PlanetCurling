var motion_1 = require("./motion");
var physical_constant_1 = require("./physical_constant");
var physics_integrator_1 = require("./physics_integrator");
var physics_world_1 = require("./physics_world");
var planet_1 = require("./planet");
var rendering_1 = require("./rendering");
var setting_1 = require("./setting");
var simulation_runner_1 = require("./simulation_runner");
var universe_1 = require("./universe");
/**
 * PlanetCurlingのAkashic Sceneを構築し、入力・シミュレーション・描画を接続します。
 */
function main(_param) {
    var scene = new g.Scene({
        game: g.game,
        assetIds: ["planet1", "planet2", "sun", "gravity_vector", "velocity_vector"]
    });
    var font = new g.DynamicFont({
        game: g.game,
        fontFamily: "sans-serif",
        size: 48
    });
    scene.onLoad.add(function () {
        var astronomicalUnit = physical_constant_1.PhysicalConstant.AstroUnit;
        var worldSpanMeters = 10 * astronomicalUnit;
        var playerPlanet = new planet_1.Planet(40000, 6 * Math.pow(10, 20), new motion_1.Pos(4 * astronomicalUnit, 4 * astronomicalUnit), new motion_1.Velocity(0, 0), new motion_1.Acceleration(0, 0));
        var secondaryPlanet = new planet_1.Planet(40000, 6 * Math.pow(10, 20), new motion_1.Pos(7 * astronomicalUnit, 6 * astronomicalUnit), new motion_1.Velocity(0, -0.003 * astronomicalUnit / setting_1.Setting.InitialVelocityReferenceSeconds), new motion_1.Acceleration(0, 0));
        var sun = new planet_1.Planet(40000, 6 * Math.pow(10, 26), new motion_1.Pos(6 * astronomicalUnit, 5 * astronomicalUnit), new motion_1.Velocity(0, 0), new motion_1.Acceleration(0, 0));
        var world = new physics_world_1.PhysicsWorld([playerPlanet, secondaryPlanet, sun]);
        var runner = new simulation_runner_1.SimulationRunner(world, physics_integrator_1.createPhysicsIntegrator(setting_1.Setting.IntegratorKind), setting_1.Setting.PhysicsStepSeconds);
        var renderer = new rendering_1.PlanetRenderer(scene, worldSpanMeters);
        var playerView = renderer.addPlanet(playerPlanet, "planet1", true);
        renderer.addPlanet(secondaryPlanet, "planet2");
        renderer.addPlanet(sun, "sun");
        var universe = new universe_1.Universe(runner, renderer, worldSpanMeters, g.game.width);
        var directionLabel = new g.Label({
            scene: scene,
            font: font,
            text: "プレイヤーをタッチして速度をつけよう",
            fontSize: 20,
            x: 10,
            y: 10
        });
        scene.append(directionLabel);
        scene.onUpdate.add(function () {
            universe.update(1 / g.game.fps);
            scene.modified();
        });
        playerView.entity.onPointDown.add(function () {
            directionLabel.text = "スワイプして方向を決めよう";
            directionLabel.invalidate();
            universe.state = universe.directionSelectState;
        });
        playerView.entity.onPointMove.add(function (event) {
            directionLabel.text = "スワイプして方向を決めよう";
            directionLabel.invalidate();
            universe.playerDrag(event.startDelta.x, event.startDelta.y);
        });
        playerView.entity.onPointUp.add(function () {
            universe.state = universe.motionSimulationState;
            directionLabel.text = "プレイヤーをタッチして速度をつけよう";
            directionLabel.invalidate();
        });
    });
    g.game.pushScene(scene);
}
module.exports = main;
