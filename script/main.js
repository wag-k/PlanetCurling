var game_balance_1 = require("./game_balance");
var match_controller_1 = require("./match_controller");
var physics_integrator_1 = require("./physics_integrator");
var physics_world_1 = require("./physics_world");
var rendering_1 = require("./rendering");
var setting_1 = require("./setting");
var simulation_runner_1 = require("./simulation_runner");
var universe_1 = require("./universe");
/**
 * PlanetCurlingのAkashic Sceneを構築し、2人対戦の入力・ターン進行・描画を接続します。
 */
function main(_param) {
    var scene = new g.Scene({
        game: g.game,
        assetIds: ["planet1", "planet2", "sun", "gravity_vector", "velocity_vector"]
    });
    var font = new g.DynamicFont({
        game: g.game,
        fontFamily: "sans-serif",
        size: 32
    });
    scene.onLoad.add(function () {
        var runner = new simulation_runner_1.SimulationRunner(new physics_world_1.PhysicsWorld(), physics_integrator_1.createPhysicsIntegrator(setting_1.Setting.IntegratorKind), setting_1.Setting.PhysicsStepSeconds);
        var matchController = new match_controller_1.MatchController(runner);
        var renderer = new rendering_1.PlanetRenderer(scene, game_balance_1.GameBalance.WorldSpanMeters);
        var universe = new universe_1.Universe(matchController, renderer, game_balance_1.GameBalance.WorldSpanMeters, g.game.width);
        var turnLabel = new g.Label({
            scene: scene,
            font: font,
            text: "",
            fontSize: 22,
            x: 10,
            y: 10
        });
        var stateLabel = new g.Label({
            scene: scene,
            font: font,
            text: "",
            fontSize: 20,
            x: 10,
            y: 42
        });
        var scoreLabel = new g.Label({
            scene: scene,
            font: font,
            text: "",
            fontSize: 22,
            x: 10,
            y: 72
        });
        var targetOrbitLabel = new g.Label({
            scene: scene,
            font: font,
            text: "Target: 2 AU  Rings = position guide; radial speed also counts",
            fontSize: 15,
            x: 150,
            y: 104
        });
        var trajectoryLabel = new g.Label({
            scene: scene,
            font: font,
            text: "Dotted: prediction (10y)   Solid: actual trail",
            fontSize: 15,
            x: 150,
            y: 124
        });
        var newGameButton = new g.FilledRect({
            scene: scene,
            cssColor: "#303030",
            x: g.game.width - 180,
            y: 10,
            width: 160,
            height: 48,
            touchable: true
        });
        var newGameLabel = new g.Label({
            scene: scene,
            font: font,
            text: "New Game",
            fontSize: 20,
            x: g.game.width - 155,
            y: 22
        });
        /** 現在の試合状態を画面上のターン情報へ反映します。 */
        function updateLabels() {
            var playerText = matchController.currentPlayer === match_controller_1.Player.Red ? "RED" : "BLUE";
            turnLabel.text = matchController.state === match_controller_1.MatchState.MatchFinished
                ? "Total: 6 / 6"
                : "Turn: " + playerText
                    + "  Shot: " + matchController.getCurrentPlayerShotNumber() + " / " + matchController.shotsPerPlayer
                    + "  Total: " + matchController.getCurrentTotalShotNumber() + " / " + matchController.maximumTotalShots;
            if (matchController.state === match_controller_1.MatchState.Aiming) {
                stateLabel.text = "Aim and release";
            }
            else if (matchController.state === match_controller_1.MatchState.Simulating) {
                stateLabel.text = "Simulating...";
            }
            else if (matchController.state === match_controller_1.MatchState.TurnTransition) {
                stateLabel.text = "Next turn...";
            }
            else if (matchController.result === match_controller_1.MatchResult.RedWin) {
                stateLabel.text = "Match Finished - RED WINS";
            }
            else if (matchController.result === match_controller_1.MatchResult.BlueWin) {
                stateLabel.text = "Match Finished - BLUE WINS";
            }
            else {
                stateLabel.text = "Match Finished - DRAW";
            }
            scoreLabel.text = "RED " + matchController.redScore + "  -  " + matchController.blueScore + " BLUE";
            turnLabel.invalidate();
            stateLabel.invalidate();
            scoreLabel.invalidate();
        }
        /** 指定した駒のViewへ、その駒がactiveStoneの場合だけ有効になる入力を接続します。 */
        function bindStoneInput(stone, view) {
            view.entity.onPointDown.add(function () {
                if (matchController.state === match_controller_1.MatchState.Aiming && matchController.activeStone === stone) {
                    stateLabel.text = "Swipe to choose direction";
                    stateLabel.invalidate();
                }
            });
            view.entity.onPointMove.add(function (event) {
                if (matchController.activeStone === stone) {
                    universe.playerDrag(event.startDelta.x, event.startDelta.y);
                }
            });
            view.entity.onPointUp.add(function () {
                if (matchController.activeStone === stone && universe.releaseActiveStone()) {
                    updateLabels();
                }
            });
        }
        /** 物理世界へ動的追加された投球駒に、所有者別の既存画像Viewを追加します。 */
        function synchronizeStoneViews() {
            matchController.stones.forEach(function (stone) {
                if (renderer.findView(stone.body) !== undefined) {
                    return;
                }
                var imageAssetId = stone.owner === match_controller_1.Player.Red ? "planet1" : "planet2";
                renderer.addStoneTrajectory(stone);
                bindStoneInput(stone, renderer.addPlanet(stone.body, imageAssetId, true));
            });
        }
        /** New Game後の新しい物理モデルに合わせて全Viewを作り直します。 */
        function rebuildPlanetViews() {
            renderer.clear();
            renderer.setTargetOrbit(matchController.centralBody);
            renderer.addPlanet(matchController.centralBody, "sun");
            synchronizeStoneViews();
            renderer.update();
        }
        newGameButton.onPointDown.add(function () {
            universe.newGame();
            rebuildPlanetViews();
            updateLabels();
        });
        rebuildPlanetViews();
        scene.append(turnLabel);
        scene.append(stateLabel);
        scene.append(scoreLabel);
        scene.append(targetOrbitLabel);
        scene.append(trajectoryLabel);
        scene.append(newGameButton);
        scene.append(newGameLabel);
        updateLabels();
        scene.onUpdate.add(function () {
            universe.update(1 / g.game.fps);
            synchronizeStoneViews();
            updateLabels();
            scene.modified();
        });
    });
    g.game.pushScene(scene);
}
module.exports = main;
