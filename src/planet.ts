import {Pos, Velocity, Acceleration, Polar} from "./motion";
import { Universe } from "./universe";

/*
 * 惑星クラス
 * 長さの単位はMeter
 */
export class Planet {
  radius:number;
  mass:number;
  pos:Pos;
  velocity:Velocity;
  acceleration:Acceleration;
  entity:g.Sprite;
  universe:Universe;

  gravityVector:g.Sprite; // 重力Vector
  velocityVector:g.Sprite; // 重力Vector
  constructor(universe = new Universe(new g.Scene({game:g.game})), radius=0, mass=0, initPos = new Pos(0,0), initVelocity = new Velocity(0,0), initAcceleration = new Acceleration(0,0)) {
    this.universe = universe;
    this.radius = radius;
    this.mass = mass;
    this.pos = initPos;
    this.velocity = initVelocity;
    this.acceleration = initAcceleration;
    
    // 矢印エンティティ作成
    var gravityVectorImageAsset = universe.scene.asset.getImageById("gravity_vector");
    var velocityVectorImageAsset = universe.scene.asset.getImageById("velocity_vector");
    this.gravityVector = new g.Sprite({
      scene: this.universe.scene,
      src: gravityVectorImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(0),
      y: Math.floor(100),
    });
    this.velocityVector = new g.Sprite({
      scene: this.universe.scene,
      src: velocityVectorImageAsset,
      scaleX: 0.2,
      scaleY: 0.2,
      x: Math.floor(100),
      y: Math.floor(100),
    });
    this.universe.scene.append(this.gravityVector);
    this.universe.scene.append(this.velocityVector);
  }

/**
 * 加速度、速度、位置を更新。オイラー法ではなくて、運動量でやったほうが精度よくなるらしい。
 * @param {*} deltaTime 
 * @param {*} acceleration 
 */
  updatePos(deltaTime:number, acceleration:Acceleration):void {
    this.acceleration.update(acceleration);
    this.velocity.update(deltaTime, this.acceleration);
    this.pos.update(deltaTime, this.velocity);
  } 

  updateVector():void {
    this.velocityVector.modified();
    this.gravityVector.modified();
  }

  clone() {
    var cloned = new Planet(this.universe, this.radius, this.mass, this.pos.clone(), this.velocity.clone(), this.acceleration.clone());
    // entityもcloneしたい
    return cloned;
  }
}
