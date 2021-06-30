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

// 本当は別ファイルにしたい、けど別ファイルを読み込む方法がよくわからない。
class Pos{
  constructor(x, y) {
      this.x = x;
      this.y = y;
  }
  update(deltaTime, velocity) {
    this.x += velocity.x * deltaTime;
    this.y += velocity.y * deltaTime;
  }

  clone(){
    return new Pos(this.x, this.y);
  }
}

class Velocity{
  constructor(x, y, acceleration) {
      this.x = x;
      this.y = y;
  }

  update(deltaTime, acceleration) {
    this.x += acceleration.x * deltaTime;
    this.y += acceleration.y * deltaTime;
  }
  clone(){
    return new Velocity(this.x, this.y);
  }
}

class Acceleration{
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  update(acceleration){
    this.x = acceleration.x;
    this.y = acceleration.y;
  }
  clone(){
    return new Acceleration(this.x, this.y);
  }
}

class Planet {
  constructor(radius, mass, initPos = new Pos(0,0), initVelocity = new Velocity(0,0), initAcceleration = new Acceleration(0,0)) {
    this.radius = radius;
    this.mass = mass;
    this.pos = initPos; // 型の制約どうやってつけるの？
    this.velocity = initVelocity;
    this.acceleration = initAcceleration;
  }

  set entity(entity){this._entity = entity;}
  get entity(){return this._entity;}

  updatePos(deltaTime, acceleration) {
    this.acceleration.update(acceleration);
    this.velocity.update(deltaTime, this.acceleration);
    this.pos.update(deltaTime, this.velocity);
  } 

  clone() {
    var cloned = new Planet(this.radius, this.mass, this.pos.clone, this.velocity.clone(), this.acceleration.clone());
    return cloned;
  }
}

class MotionSimulationState {
  constructor(universe){
    this.universe = universe;
  }
  update(){
    const deltaTime = Setting.TimeStepSec;
    this.universe.planets.forEach((planet, idx) => {
      var acceleration = calcGravity(this.universe.planets, idx);
      planet.updatePos(deltaTime, acceleration);
      planet.entity.x = meterToPx(planet.pos.x);
      planet.entity.y = meterToPx(planet.pos.y);
      planet.entity.modified();
    });
  }
}

class Universe {
  /**
   * 
   * @param {Array<Planet>} planets 
   * @param {int} width 
   * @param {int} height 
   */
  constructor(scene, planets = new Array(), worldWidthMeter=0, worldHeightMeter=0){
    this.scene = scene;
    this.planets = planets;
    this.worldWidthMeter = worldWidthMeter;
    this.worldHeightMeter = worldHeightMeter;
    this.planets.forEach(planet => {
      this.scene.append(planet.entity);
    });
    this.motionSimulationState = new MotionSimulationState(this);
    this.state = this.motionSimulationState;
  }
  
  addPlanet(planet){
    this.planets.push(planet);
    this.scene.append(planet.entity);
  }

  update(){
    this.state.update();
  }
}

// 多体の重力を計算
function calcGravity(mainPlanet, subPlanets = new Array<Planet>[]){
  var acceleration = new Acceleration(0.0, 0.0); // 成分に分けてreturn
  subPlanets.forEach(subPlanet => {
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

// 多体の重力を計算
function calcGravity(planets=new Array<Planet>[], mainPlanetIdx=0){
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
function meterToPx(meter){
  const astroUnit = PhysicalConstant.AstroUnit; // 天文単位
  // 10AUを画面の端（短辺）として考えてみる。 
  return Math.floor(meter/1000/astroUnit*Math.min(g.game.width, g.game.height));
}


function main(param) {

  var scene = new g.Scene({
    game: g.game,
    // このシーンで利用するアセットのIDを列挙し、シーンに通知します
    assetIds: ["planet1", "planet2", "sun"]
  });
  scene.onLoad.add(function () {
    // ここからゲーム内容を記述します
    // 各アセットオブジェクトを取得します
    /*
    var playerImageAsset = scene.asset.getImageById("player");
    var shotImageAsset = scene.asset.getImageById("shot");
    var seAudioAsset = scene.asset.getAudioById("se");
    */
    // 惑星を配置
    const astroUnit = PhysicalConstant.AstroUnit;
    var planet1 = new Planet(40000.0, 6*Math.pow(10.0,14), new Pos(400.0*astroUnit, 400*astroUnit), new Velocity(0,0), new Acceleration(0,0));
    var planet2 = new Planet(40000.0, 6*Math.pow(10.0,14), new Pos(500.0*astroUnit, 600*astroUnit), new Velocity(0.0,0.0), new Acceleration(0.0,0.0));
    var planet3 = new Planet(40000.0, 6*Math.pow(10.0,18), new Pos(600.0*astroUnit, 500*astroUnit), new Velocity(0.0,0.0), new Acceleration(0.0,0.0));

    // プレイヤーを生成します
    var planet1ImageAsset = scene.asset.getImageById("planet1");
    var planet2ImageAsset = scene.asset.getImageById("planet2");
    var planet3ImageAsset = scene.asset.getImageById("sun");
    var planet1Size = Math.max(meterToPx(planet1.radius), 5);
    var player1 = new g.Sprite({
      scene: scene,
      src: planet1ImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(meterToPx(planet1.pos.x)),
      y: Math.floor(meterToPx(planet1.pos.y)),
    });
    planet1.entity = player1;

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

    var universe = new Universe(scene, [planet1, planet2, planet3], 100*astroUnit, 100*astroUnit); // 宇宙創造


    scene.onUpdate.add(function () {
      universe.update();
      scene.modified();
    });
    
    player1.onUpdate.add(function () {
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
module.exports = main;
