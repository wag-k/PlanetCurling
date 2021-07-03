import { CommonArea, PointMoveEvent, Scene, Sprite } from "@akashic/akashic-engine";

/**
 * 物理定数
 */
class PhysicalConstant{
  static get AstroUnit() {return 149597870700.0;} // 天文単位
  static get ConstantOfGravitation() {return 6.67430 * Math.pow(10.0, -11.0);}
} 

/**
 * 設定
 */
class Setting{
  static get TimeStepSec(){return 60*60*24*30.0*1;} // 1frame約1か月 
}

/**
 * 座標軸のenum
 */
const Coordinate =  {
  "Orthogonal": 0,
  "Polar": 1, 
};

// 本当は別ファイルにしたい、けど別ファイルを読み込む方法がよくわからない。
/**
 * 位置クラス
 * 単位はMeterを想定しているけど、Pxも可。プログラム中で分かるようにしておくこと
 */
class Pos{
  x:number;
  y:number;
  constructor(x: number, y: number) {
      this.x = x;
      this.y = y;
  }
/**
 * オイラー法的に位置を更新
 * @param {*} deltaTime 
 * @param {*} velocity 
 */
  update(deltaTime:number, velocity:Velocity) {
    this.x += velocity.x * deltaTime;
    this.y += velocity.y * deltaTime;
  }

  clone(){
    return new Pos(this.x, this.y);
  }
}

/**
 * 速度クラス
 */
class Velocity{
  x:number;
  y:number;
  constructor(x:number, y:number) {
      this.x = x;
      this.y = y;
  }

/**
 * オイラー法的に速度を更新
 * @param {*} deltaTime 
 * @param {*} acceleration 
 */
  update(deltaTime:number, acceleration:Acceleration) {
    this.x += acceleration.x * deltaTime;
    this.y += acceleration.y * deltaTime;
  }
  clone(){
    return new Velocity(this.x, this.y);
  }
}

/**
 * 加速度クラス。
 */
class Acceleration{
  x:number;
  y:number;
  constructor(x:number, y:number) {
    this.x = x;
    this.y = y;
  }
  update(acceleration:Acceleration){
    this.x = acceleration.x;
    this.y = acceleration.y;
  }
  clone(){
    return new Acceleration(this.x, this.y);
  }
}

/**
 * 極座標クラス
 */
class Polar{
  radius:number;
  angular:number;
  constructor(radius:number, angular:number){
    this.radius = radius; // meter
    this.angular = angular; // rad
  }

  set angularDegree(degree:number){
    this.angular = degree/180.0*Math.PI;
  }

  get angularDegree(){
    return this.angular/Math.PI*180.0;
  }

  static orthogonalToPolar(center:Pos, pos:Pos) {
    var deltaX = pos.x - center.x;
    var deltaY = pos.y - center.y;
    var radius = Math.sqrt(Math.pow(deltaX,2.0) + Math.pow(deltaY,2.0));
    var angular = 0;
    if (deltaX != 0){
      angular = Math.atan2(deltaY, deltaX);
    }
    return new Polar(radius, angular);
  }

  toOrthogonal(center:Pos){
    var x = center.x + this.radius*Math.cos(this.angular);
    var y = center.y + this.radius*Math.sin(this.angular);
    return new Pos(x, y);
  }
}



/**
 * 惑星クラス
 * 長さの単位はMeter
 */
class Planet {
  radius:number;
  mass:number;
  pos:Pos;
  velocity:Velocity;
  acceleration:Acceleration;
  entity:Sprite;
  constructor(radius=0, mass=0, initPos = new Pos(0,0), initVelocity = new Velocity(0,0), initAcceleration = new Acceleration(0,0)) {
    this.radius = radius;
    this.mass = mass;
    this.pos = initPos; // 型の制約どうやってつけるの？
    this.velocity = initVelocity;
    this.acceleration = initAcceleration;
  }

/**
 * 加速度、速度、位置を更新。オイラー法ではなくて、運動量でやったほうが精度よくなるらしい。
 * @param {*} deltaTime 
 * @param {*} acceleration 
 */
  updatePos(deltaTime:number, acceleration:Acceleration) {
    this.acceleration.update(acceleration);
    this.velocity.update(deltaTime, this.acceleration);
    this.pos.update(deltaTime, this.velocity);
  } 

  clone() {
    var cloned = new Planet(this.radius, this.mass, this.pos.clone(), this.velocity.clone(), this.acceleration.clone());
    // entityもcloneしたい
    return cloned;
  }
}

interface IUniverseState{
  stateChanged():void;
  update():void;
  playerDrag(ev:PointMoveEvent):void;
}

/**
 * Universeの動作State
 * 惑星軌道シミュレーション中
 */
class MotionSimulationState implements IUniverseState {
  universe:Universe
  constructor(universe:Universe){
    this.universe = universe;
  }

  stateChanged(){

  }

  update(){
    const deltaTime = Setting.TimeStepSec;
    this.universe.planets.forEach((planet, idx) => {
      var acceleration = calcGravity(this.universe.planets, idx);
      acceleration.x = acceleration.x/planet.mass;
      acceleration.y = acceleration.y/planet.mass;
      planet.updatePos(deltaTime, acceleration);
      planet.entity.x = meterToPx(planet.pos.x);
      planet.entity.y = meterToPx(planet.pos.y);
      planet.entity.modified();
    });
  }
  playerDrag(ev:PointMoveEvent){
    
  }
}

/**
 * Universeの動作State
 * 惑星の速度をスワイプで決定する
 */
class DirectionSelectState implements IUniverseState {
  universe:Universe;
  startPos:Pos;
  endPos:Pos;
  gravityVector:Sprite;
  velocityVector:Sprite;
  constructor(universe:Universe){
    this.universe = universe;
    this.startPos = new Pos(0, 0); // 
    this.endPos = new Pos(0, 0);
    
    // 矢印エンティティ作成
    var gravityVectorImageAsset = universe.scene.asset.getImageById("gravity_vector");
    var velocityVectorImageAsset = universe.scene.asset.getImageById("velocity_vector");
    this.gravityVector = new g.Sprite({
      scene: this.universe.scene,
      src: gravityVectorImageAsset,
      scaleX: 0.2,
      scaleY: 1.0,
      x: Math.floor(0),
      y: Math.floor(0),
    });
    this.velocityVector = new g.Sprite({
      scene: this.universe.scene,
      src: velocityVectorImageAsset,
      scaleX: 0.2,
      scaleY: 0.0,
      x: Math.floor(0),
      y: Math.floor(0),
    });
    this.universe.scene.append(this.gravityVector);
    this.universe.scene.append(this.velocityVector);
    
  }
  
  stateChanged(){
    const deltaTime = Setting.TimeStepSec;
    this.universe.planets.forEach((planet, idx) => {
      // そのうち全部回す
      if ( idx == 0){
        var gravity = calcGravity(this.universe.planets, idx);
        let gravityStrength = Math.sqrt(Math.pow(gravity.x, 2.0) + Math.pow(gravity.y,2.0));
        gravityStrength = gravityStrength;
        let sizeVector = meterToPx(gravityStrength/Math.pow(10,4));
        this.gravityVector.height = sizeVector;
        this.gravityVector.modified();
      }
    });
  }

  update(){
  }

  playerDrag(ev:PointMoveEvent){
    const deltaTime = Setting.TimeStepSec;
    var deltaX = ev.startDelta.x;
    var deltaY = ev.startDelta.y;
    var velocityPerPx = - this.universe.worldWidthMeter/deltaTime/g.game.width/100; // 適当な数で割っておかないと、速度が早くなりすぎる。
    this.universe.planets[0].velocity.x = velocityPerPx*deltaX;
    this.universe.planets[0].velocity.y = velocityPerPx*deltaY;
  }
}

class Universe {
  scene:Scene;
  planets:Array<Planet>;
  worldWidthMeter:number;
  worldHeightMeter:number;
  motionSimulationState:MotionSimulationState;
  directionSelectState:DirectionSelectState;
  private _state:IUniverseState;
  /**
   * 
   * @param {Array<Planet>} planets 
   * @param {int} width 
   * @param {int} height 
   */
  constructor(scene:Scene, planets = new Array<Planet>(), worldWidthMeter=0, worldHeightMeter=0){
    this.scene = scene;
    this.planets = planets;
    this.worldWidthMeter = worldWidthMeter;
    this.worldHeightMeter = worldHeightMeter;
    this.planets.forEach(planet => {
      this.scene.append(planet.entity);
    });

    this.motionSimulationState = new MotionSimulationState(this);
    this.directionSelectState = new DirectionSelectState(this);
    
    this.state = this.directionSelectState; // 外からはstateのSetterで変更してもらう。

  }
  
  addPlanet(planet:Planet){
    this.planets.push(planet);
    this.scene.append(planet.entity);
  }

  get state() {return this._state;}
  set state(state) {
    this._state = state;
    this.state.stateChanged();
  }

  update(){
    this.state.update();
  }
  
  playerDrag(ev:PointMoveEvent){
    this.state.playerDrag(ev);
  }
}

// 多体の重力を計算
function calcGravity(planets=new Array<Planet>(), mainPlanetIdx=0){
  var acceleration = new Acceleration(0.0, 0.0); // 成分に分けてreturn
  var mainPlanet = planets[mainPlanetIdx];
  planets.forEach((subPlanet, planetIdx) => {
    if(planetIdx == mainPlanetIdx){return;}
    var deltaX = subPlanet.pos.x - mainPlanet.pos.x;
    var deltaY = subPlanet.pos.y - mainPlanet.pos.y;
    var distance = Math.sqrt(Math.pow(deltaX,2.0) + Math.pow(deltaY,2.0));

    const constantOfGravitation = PhysicalConstant.ConstantOfGravitation;
    var gravity = constantOfGravitation * mainPlanet.mass * subPlanet.mass / Math.pow(distance, 2.0); // 万有引力
    acceleration.x += gravity*deltaX/distance;
    acceleration.y += gravity*deltaY/distance; // 成分に分けてreturn
  });
  return acceleration;
}

// meterが何pxに相当するか返します。
function meterToPx(meter:number){
  const astroUnit = PhysicalConstant.AstroUnit; // 天文単位
  // 10AUを画面の端（短辺）として考えてみる。 
  return Math.floor(meter/10/astroUnit*Math.min(g.game.width, g.game.height));
}

function pxToMeter(px:number){
  return px/meterToPx(1);
}

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
    // ここからゲーム内容を記述します
    // 惑星を配置
    const astroUnit = PhysicalConstant.AstroUnit;
    const deltaTime = Setting.TimeStepSec;
    var planet1 = new Planet(40000.0, 6*Math.pow(10.0, 20.0), new Pos(4.0*astroUnit, 4*astroUnit), new Velocity(0,0.0), new Acceleration(0,0));
    var planet2 = new Planet(40000.0, 6*Math.pow(10.0,20), new Pos(7.0*astroUnit, 6.0*astroUnit), new Velocity(0.0,-0.003*astroUnit/deltaTime), new Acceleration(0.0,0.0));
    var planet3 = new Planet(40000.0, 6*Math.pow(10.0,26), new Pos(6.0*astroUnit, 5*astroUnit), new Velocity(0.0,0.0), new Acceleration(0.0,0.0));

    // 各アセットオブジェクトを取得します
    var planet1ImageAsset = scene.asset.getImageById("planet1");
    var planet2ImageAsset = scene.asset.getImageById("planet2");
    var planet3ImageAsset = scene.asset.getImageById("sun");

    // プレイヤーを生成します
    // 惑星１（主人公）
    var planet1Size = Math.max(meterToPx(planet1.radius), 5);
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
    var planet2Size = Math.max(meterToPx(planet2.radius), 5);
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
    var planet3Size = Math.max(meterToPx(planet3.radius), 5);
    var player3 = new g.Sprite({
      scene: scene,
      src: planet3ImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(meterToPx(planet3.pos.x)),
      y: Math.floor(meterToPx(planet3.pos.y)),
    });
    planet3.entity = player3;

    var universe = new Universe(scene, [planet1, planet2, planet3], 10*astroUnit, 10*astroUnit); // 宇宙創造
  
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
    player1.onPointMove.add(function(ev:PointMoveEvent) {
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
