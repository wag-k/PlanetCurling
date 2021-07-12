import {Setting} from "./setting";
import {Pos, Velocity, Acceleration, Polar, meterToPx, squareSumRoot} from "./motion";
import {Universe, calcGravity} from "./universe";
import {Planet} from "./planet";

export interface IUniverseState{
  stateChanged():void;
  update():void;
  playerDrag(ev:g.PointMoveEvent):void;
}

/**
 * Universeの動作State
 * 惑星軌道シミュレーション中
 */
export class MotionSimulationState implements IUniverseState {
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
  playerDrag(ev:g.PointMoveEvent){
    
  }
}

/**
 * Universeの動作State
 * 惑星の速度をスワイプで決定する
 */
export class DirectionSelectState implements IUniverseState {
  universe:Universe;
  startPos:Pos;
  endPos:Pos;
  constructor(universe:Universe){
    this.universe = universe;
    this.startPos = new Pos(0, 0); // 
    this.endPos = new Pos(0, 0);
    
    
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
        planet.gravityVector.height = sizeVector;
        planet.gravityVector.invalidate();
      }
      
    });
  }

  update(){
    this.universe.planets.forEach((planet, idx) => {
      planet.updateVector();
    });
  }

  playerDrag(ev:g.PointMoveEvent){
    const deltaTime = Setting.TimeStepSec;
    let deltaX = ev.startDelta.x;
    let deltaY = ev.startDelta.y;
    let distance = squareSumRoot([deltaX, deltaY]);
    let velocityPerPx = - this.universe.worldWidthMeter/deltaTime/g.game.width/100; // 適当な数で割っておかないと、速度が早くなりすぎる。
    this.universe.planets[0].velocity.x = velocityPerPx*deltaX;
    this.universe.planets[0].velocity.y = velocityPerPx*deltaY;
    let sizeVector = Math.floor(Math.abs(velocityPerPx)*distance*1);
    this.universe.planets[0].velocityVector.height = sizeVector;
    this.universe.planets[0].velocityVector.invalidate();
  }
}
