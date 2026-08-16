var game_balance_1 = require("./game_balance");
var game_hud_view_1 = require("./game_hud_view");
var match_controller_1 = require("./match_controller");
var physics_integrator_1 = require("./physics_integrator");
var physics_world_1 = require("./physics_world");
var rendering_1 = require("./rendering");
var responsive_layout_1 = require("./responsive_layout");
var setting_1 = require("./setting");
var simulation_runner_1 = require("./simulation_runner");
var universe_1 = require("./universe");
/** PlanetCurlingのScene構築とController / Renderer / HUDの接続だけを担当します。 */
function main(_param) {
    var scene = new g.Scene({ game: g.game, assetIds: ["planet1", "planet2", "sun", "se"] });
    var font = new g.DynamicFont({ game: g.game, fontFamily: "sans-serif", size: 40 });
    scene.onLoad.add(function () {
        var layout = responsive_layout_1.calculateCurrentLayout(g.game.width, g.game.height);
        var runner = new simulation_runner_1.SimulationRunner(new physics_world_1.PhysicsWorld(), physics_integrator_1.createPhysicsIntegrator(setting_1.Setting.IntegratorKind), setting_1.Setting.PhysicsStepSeconds);
        var matchController = new match_controller_1.MatchController(runner);
        var renderer = new rendering_1.PlanetRenderer(scene, game_balance_1.GameBalance.WorldSpanMeters, layout);
        var universe = new universe_1.Universe(matchController, renderer, game_balance_1.GameBalance.WorldSpanMeters, g.game.width);
        var guideLayer = new g.E({ scene: scene });
        scene.append(guideLayer);
        var launchGuide = new rendering_1.LaunchGuideView(scene, guideLayer, function () { return matchController.state === match_controller_1.MatchState.Aiming ? matchController.activeStone : undefined; }, game_balance_1.GameBalance.WorldSpanMeters, layout);
        var hud = new game_hud_view_1.GameHudView(scene, font, matchController, renderer.trajectoryVisibility, layout);
        var orientationNotice = new game_hud_view_1.OrientationNoticeView(scene, font, layout);
        /** activeStoneだけへドラッグ入力とreleaseを接続します。 */
        function bindStoneInput(stone, view) {
            if (view.inputEntity === undefined)
                return;
            view.inputEntity.onPointMove.add(function (event) {
                if (matchController.activeStone === stone)
                    universe.playerDrag(event.startDelta.x, event.startDelta.y);
            });
            view.inputEntity.onPointUp.add(function () {
                if (matchController.activeStone === stone)
                    universe.releaseActiveStone();
            });
        }
        /** 動的に生成されたStoneへ所有者色のViewと軌跡Viewを一度だけ追加します。 */
        function synchronizeStoneViews() {
            matchController.stones.forEach(function (stone) {
                var existing = renderer.findView(stone.body);
                if (existing !== undefined) {
                    existing.setVisible(!stone.isAbsorbed);
                    existing.setInputActive(matchController.state === match_controller_1.MatchState.Aiming
                        && matchController.activeStone === stone && !stone.isAbsorbed);
                    return;
                }
                renderer.addStoneTrajectory(stone);
                var view = renderer.addPlanet(stone.body, stone.owner === match_controller_1.Player.Red ? "planet1" : "planet2", true);
                view.setVisible(!stone.isAbsorbed);
                view.setInputActive(matchController.state === match_controller_1.MatchState.Aiming
                    && matchController.activeStone === stone && !stone.isAbsorbed);
                bindStoneInput(stone, view);
            });
        }
        /** New Game後も同じnewGame()を再利用して盤面Viewだけを再構築します。 */
        function rebuildPlanetViews() {
            renderer.clear();
            renderer.setTargetOrbit(matchController.centralBody);
            renderer.addPlanet(matchController.centralBody, "sun");
            synchronizeStoneViews();
            renderer.update();
        }
        hud.rematchButton.onPointDown.add(function () {
            universe.newGame();
            rebuildPlanetViews();
        });
        rebuildPlanetViews();
        hud.update();
        scene.onUpdate.add(function () {
            universe.update(1 / g.game.fps);
            synchronizeStoneViews();
            launchGuide.modified();
            hud.update();
            orientationNotice.update();
            scene.modified();
        });
    });
    g.game.pushScene(scene);
}
module.exports = main;
