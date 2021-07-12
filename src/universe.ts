import * as phy_const from "./physical_constant"
import {Pos, Velocity, Acceleration, Polar, meterToPx, squareSumRoot} from "./motion";
import {Planet} from "./planet";
import * as State from "./universe_state";

export class Universe {
  scene:g.Scene;
  planets:Array<Planet>;
  worldWidthMeter:number;
  worldHeightMeter:number;
  motionSimulationState:State.MotionSimulationState;
  directionSelectState:State.DirectionSelectState;
  private _state:State.IUniverseState;
  /**
   * 
   * @param {Array<Planet>} planets 
   * @param {int} width 
   * @param {int} height 
   */
  constructor(scene:g.Scene, planets = new Array<Planet>(), worldWidthMeter=0, worldHeightMeter=0){
    this.scene = scene;
    this.planets = planets;
    this.worldWidthMeter = worldWidthMeter;
    this.worldHeightMeter = worldHeightMeter;
    this.planets.forEach(planet => {
      this.scene.append(planet.entity);
    });

    this.motionSimulationState = new State.MotionSimulationState(this);
    this.directionSelectState = new State.DirectionSelectState(this);
    
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
  
  playerDrag(ev:g.PointMoveEvent){
    this.state.playerDrag(ev);
  }
}

// 多体の重力を計算
export function calcGravity(planets=new Array<Planet>(), mainPlanetIdx=0){
  var acceleration = new Acceleration(0.0, 0.0); // 成分に分けてreturn
  var mainPlanet = planets[mainPlanetIdx];
  planets.forEach((subPlanet, planetIdx) => {
    if(planetIdx == mainPlanetIdx){return;}
    var deltaX = subPlanet.pos.x - mainPlanet.pos.x;
    var deltaY = subPlanet.pos.y - mainPlanet.pos.y;
    var distance = Math.sqrt(Math.pow(deltaX,2.0) + Math.pow(deltaY,2.0));

    const constantOfGravitation = phy_const.PhysicalConstant.ConstantOfGravitation;
    var gravity = constantOfGravitation * mainPlanet.mass * subPlanet.mass / Math.pow(distance, 2.0); // 万有引力
    acceleration.x += gravity*deltaX/distance;
    acceleration.y += gravity*deltaY/distance; // 成分に分けてreturn
  });
  return acceleration;
}
