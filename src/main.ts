import {PhysicalConstant} from "./physical_constant"
import {Setting} from "./setting";
import {Pos, Velocity, Acceleration, Polar, meterToPx} from "./motion";
import {Universe} from "./universe";
import {Planet} from "./planet";

function main(param: g.GameMainParameterObject): void {

  var scene = new g.Scene({
    game: g.game,
    // このシーンで利用するアセットのIDを列挙し、シーンに通知します
    assetIds: ["planet1", "planet2", "sun", "gravity_vector", "velocity_vector"]
  });
  var font = new g.DynamicFont({
    game: g.game,
    fontFamily: "sans-serif",
    size: 48
  });

  scene.onLoad.add(function () {
    const astroUnit = PhysicalConstant.AstroUnit;
    const deltaTime = Setting.TimeStepSec;

    // ここからゲーム内容を記述します
    var universe = new Universe(scene, new Array<Planet>(), 10*astroUnit, 10*astroUnit); // 宇宙創造

    // 惑星を生成
    var planet1 = new Planet(universe, 40000.0, 6*Math.pow(10.0, 20.0), new Pos(4.0*astroUnit, 4*astroUnit), new Velocity(0,0.0), new Acceleration(0,0));
    var planet2 = new Planet(universe, 40000.0, 6*Math.pow(10.0,20), new Pos(7.0*astroUnit, 6.0*astroUnit), new Velocity(0.0,-0.003*astroUnit/deltaTime), new Acceleration(0.0,0.0));
    var planet3 = new Planet(universe, 40000.0, 6*Math.pow(10.0,26), new Pos(6.0*astroUnit, 5*astroUnit), new Velocity(0.0,0.0), new Acceleration(0.0,0.0));

    // 各アセットオブジェクトを取得します
    var planet1ImageAsset = scene.asset.getImageById("planet1");
    var planet2ImageAsset = scene.asset.getImageById("planet2");
    var planet3ImageAsset = scene.asset.getImageById("sun");

    // プレイヤーを生成します
    // 惑星１（主人公）
    var planet1Size = Math.max(meterToPx(planet1.radius), 10);
    var player1 = new g.Sprite({
      scene: scene,
      src: planet1ImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(meterToPx(planet1.pos.x)),
      y: Math.floor(meterToPx(planet1.pos.y)),
      touchable: true,
    });
    planet1.entity = player1;

    // 惑星２
    var planet2Size = Math.max(meterToPx(planet2.radius), 10);
    var player2 = new g.Sprite({
      scene: scene,
      src: planet2ImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(meterToPx(planet2.pos.x)),
      y: Math.floor(meterToPx(planet2.pos.y)),
    });
    planet2.entity = player2;
  
    // 太陽
    var planet3Size = Math.max(meterToPx(planet3.radius), 20);
    var player3 = new g.Sprite({
      scene: scene,
      src: planet3ImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(meterToPx(planet3.pos.x)),
      y: Math.floor(meterToPx(planet3.pos.y)),
    });
    planet3.entity = player3;

    // 宇宙に惑星を追加して配置。
    universe.addPlanet(planet1);
    universe.addPlanet(planet2);
    universe.addPlanet(planet3);

  
    var directionLabel = new g.Label({
      scene: scene, // g.Sceneの値
      font: font, // g.Fontの値
      text: "プレイヤーをタッチして速度をつけよう",
      fontSize: 20,
      x: 10,
      y: 10
    });
    scene.append(directionLabel);

    // 毎フレームごとの処理
    scene.onUpdate.add(function () {
      universe.update();
      scene.modified();
    });

    // プレイヤーにタッチしたら方向選択モード
    player1.onPointDown.add(function() {
      directionLabel.text = "スワイプして方向を決めよう";
      directionLabel.invalidate();
      universe.state = universe.directionSelectState;
    });

    // ドラッグ量に応じて速度を決める
    player1.onPointMove.add(function(ev:g.PointMoveEvent) {
      directionLabel.text = "スワイプして方向を決めよう";
      directionLabel.invalidate();
      universe.playerDrag(ev);
    });

    // マウスを離したらシミュレーション開始
    player1.onPointUp.add(function() {
      universe.state = universe.motionSimulationState;
      directionLabel.text = "プレイヤーをタッチして速度をつけよう";
      directionLabel.invalidate();
    });

    /*
    // 画面をタッチしたとき、SEを鳴らします
    scene.onPointDownCapture.add(function () {
      seAudioAsset.play();
      // プレイヤーが発射する弾を生成します
      var shot = new g.Sprite({
        scene: scene,
        src: shotImageAsset,
        width: shotImageAsset.width,
        height: shotImageAsset.height
      });
      // 弾の初期座標を、プレイヤーの少し右に設定します
      shot.x = player.x + player.width;
      shot.y = player.y;
      shot.onUpdate.add(function () {
        // 毎フレームで座標を確認し、画面外に出ていたら弾をシーンから取り除きます
        if (shot.x > g.game.width)
            shot.destroy();
        // 弾を右に動かし、弾の動きを表現します
        shot.x += 10;
        // 変更をゲームに通知します
        shot.modified();
      });
      scene.append(shot);
    });
    */
    // ここまでゲーム内容を記述します
  });

  g.game.pushScene(scene);
}


export = main;
