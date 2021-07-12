
import * as phy_const from "./physical_constant"

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
export class Pos{
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
export class Velocity{
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
export class Acceleration{
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
export function squareSumRoot(array:Array<number>):number {
  let sumSquare = 0;
  array.forEach(element => {
    sumSquare += Math.pow(element, 2);
  });
  return Math.sqrt(sumSquare);
} 

/**
 * 極座標クラス
 */
export class Polar{
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

// meterが何pxに相当するか返します。
export function meterToPx(meter:number){
  const astroUnit = phy_const.PhysicalConstant.AstroUnit; // 天文単位
  // 10AUを画面の端（短辺）として考えてみる。 
  return Math.floor(meter/10/astroUnit*Math.min(g.game.width, g.game.height));
}

export function pxToMeter(px:number){
  return px/meterToPx(1);
}