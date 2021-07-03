/**
 * 物理定数
 */
var PhysicalConstant = /** @class */ (function () {
    function PhysicalConstant() {
    }
    Object.defineProperty(PhysicalConstant, "AstroUnit", {
        get: function () { return 149597870700.0; } // 天文単位
        ,
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PhysicalConstant, "ConstantOfGravitation", {
        get: function () { return 6.67430 * Math.pow(10.0, -11.0); },
        enumerable: false,
        configurable: true
    });
    return PhysicalConstant;
}());
/**
 * 設定
 */
var Setting = /** @class */ (function () {
    function Setting() {
    }
    Object.defineProperty(Setting, "TimeStepSec", {
        get: function () { return 60 * 60 * 24 * 30.0 * 1; } // 1frame約1か月 
        ,
        enumerable: false,
        configurable: true
    });
    return Setting;
}());
/**
 * 座標軸のenum
 */
var Coordinate = {
    "Orthogonal": 0,
    "Polar": 1,
};
// 本当は別ファイルにしたい、けど別ファイルを読み込む方法がよくわからない。
/**
 * 位置クラス
 * 単位はMeterを想定しているけど、Pxも可。プログラム中で分かるようにしておくこと
 */
var Pos = /** @class */ (function () {
    function Pos(x, y) {
        this.x = x;
        this.y = y;
    }
    /**
     * オイラー法的に位置を更新
     * @param {*} deltaTime
     * @param {*} velocity
     */
    Pos.prototype.update = function (deltaTime, velocity) {
        this.x += velocity.x * deltaTime;
        this.y += velocity.y * deltaTime;
    };
    Pos.prototype.clone = function () {
        return new Pos(this.x, this.y);
    };
    return Pos;
}());
/**
 * 速度クラス
 */
var Velocity = /** @class */ (function () {
    function Velocity(x, y) {
        this.x = x;
        this.y = y;
    }
    /**
     * オイラー法的に速度を更新
     * @param {*} deltaTime
     * @param {*} acceleration
     */
    Velocity.prototype.update = function (deltaTime, acceleration) {
        this.x += acceleration.x * deltaTime;
        this.y += acceleration.y * deltaTime;
    };
    Velocity.prototype.clone = function () {
        return new Velocity(this.x, this.y);
    };
    return Velocity;
}());
/**
 * 加速度クラス。
 */
var Acceleration = /** @class */ (function () {
    function Acceleration(x, y) {
        this.x = x;
        this.y = y;
    }
    Acceleration.prototype.update = function (acceleration) {
        this.x = acceleration.x;
        this.y = acceleration.y;
    };
    Acceleration.prototype.clone = function () {
        return new Acceleration(this.x, this.y);
    };
    return Acceleration;
}());
/**
 * 極座標クラス
 */
var Polar = /** @class */ (function () {
    function Polar(radius, angular) {
        this.radius = radius; // meter
        this.angular = angular; // rad
    }
    Object.defineProperty(Polar.prototype, "angularDegree", {
        get: function () {
            return this.angular / Math.PI * 180.0;
        },
        set: function (degree) {
            this.angular = degree / 180.0 * Math.PI;
        },
        enumerable: false,
        configurable: true
    });
    Polar.orthogonalToPolar = function (center, pos) {
        var deltaX = pos.x - center.x;
        var deltaY = pos.y - center.y;
        var radius = Math.sqrt(Math.pow(deltaX, 2.0) + Math.pow(deltaY, 2.0));
        var angular = 0;
        if (deltaX != 0) {
            angular = Math.atan2(deltaY, deltaX);
        }
        return new Polar(radius, angular);
    };
    Polar.prototype.toOrthogonal = function (center) {
        var x = center.x + this.radius * Math.cos(this.angular);
        var y = center.y + this.radius * Math.sin(this.angular);
        return new Pos(x, y);
    };
    return Polar;
}());
/**
 * 惑星クラス
 * 長さの単位はMeter
 */
var Planet = /** @class */ (function () {
    function Planet(radius, mass, initPos, initVelocity, initAcceleration) {
        if (radius === void 0) { radius = 0; }
        if (mass === void 0) { mass = 0; }
        if (initPos === void 0) { initPos = new Pos(0, 0); }
        if (initVelocity === void 0) { initVelocity = new Velocity(0, 0); }
        if (initAcceleration === void 0) { initAcceleration = new Acceleration(0, 0); }
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
    Planet.prototype.updatePos = function (deltaTime, acceleration) {
        this.acceleration.update(acceleration);
        this.velocity.update(deltaTime, this.acceleration);
        this.pos.update(deltaTime, this.velocity);
    };
    Planet.prototype.clone = function () {
        var cloned = new Planet(this.radius, this.mass, this.pos.clone(), this.velocity.clone(), this.acceleration.clone());
        // entityもcloneしたい
        return cloned;
    };
    return Planet;
}());
/**
 * Universeの動作State
 * 惑星軌道シミュレーション中
 */
var MotionSimulationState = /** @class */ (function () {
    function MotionSimulationState(universe) {
        this.universe = universe;
    }
    MotionSimulationState.prototype.stateChanged = function () {
    };
    MotionSimulationState.prototype.update = function () {
        var _this = this;
        var deltaTime = Setting.TimeStepSec;
        this.universe.planets.forEach(function (planet, idx) {
            var acceleration = calcGravity(_this.universe.planets, idx);
            acceleration.x = acceleration.x / planet.mass;
            acceleration.y = acceleration.y / planet.mass;
            planet.updatePos(deltaTime, acceleration);
            planet.entity.x = meterToPx(planet.pos.x);
            planet.entity.y = meterToPx(planet.pos.y);
            planet.entity.modified();
        });
    };
    MotionSimulationState.prototype.playerDrag = function (ev) {
    };
    return MotionSimulationState;
}());
/**
 * Universeの動作State
 * 惑星の速度をスワイプで決定する
 */
var DirectionSelectState = /** @class */ (function () {
    function DirectionSelectState(universe) {
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
    DirectionSelectState.prototype.stateChanged = function () {
        var _this = this;
        var deltaTime = Setting.TimeStepSec;
        this.universe.planets.forEach(function (planet, idx) {
            // そのうち全部回す
            if (idx == 0) {
                var gravity = calcGravity(_this.universe.planets, idx);
                var gravityStrength = Math.sqrt(Math.pow(gravity.x, 2.0) + Math.pow(gravity.y, 2.0));
                gravityStrength = gravityStrength;
                var sizeVector = meterToPx(gravityStrength / Math.pow(10, 4));
                _this.gravityVector.height = sizeVector;
                _this.gravityVector.modified();
            }
        });
    };
    DirectionSelectState.prototype.update = function () {
    };
    DirectionSelectState.prototype.playerDrag = function (ev) {
        var deltaTime = Setting.TimeStepSec;
        var deltaX = ev.startDelta.x;
        var deltaY = ev.startDelta.y;
        var velocityPerPx = -this.universe.worldWidthMeter / deltaTime / g.game.width / 100; // 適当な数で割っておかないと、速度が早くなりすぎる。
        this.universe.planets[0].velocity.x = velocityPerPx * deltaX;
        this.universe.planets[0].velocity.y = velocityPerPx * deltaY;
    };
    return DirectionSelectState;
}());
var Universe = /** @class */ (function () {
    /**
     *
     * @param {Array<Planet>} planets
     * @param {int} width
     * @param {int} height
     */
    function Universe(scene, planets, worldWidthMeter, worldHeightMeter) {
        var _this = this;
        if (planets === void 0) { planets = new Array(); }
        if (worldWidthMeter === void 0) { worldWidthMeter = 0; }
        if (worldHeightMeter === void 0) { worldHeightMeter = 0; }
        this.scene = scene;
        this.planets = planets;
        this.worldWidthMeter = worldWidthMeter;
        this.worldHeightMeter = worldHeightMeter;
        this.planets.forEach(function (planet) {
            _this.scene.append(planet.entity);
        });
        this.motionSimulationState = new MotionSimulationState(this);
        this.directionSelectState = new DirectionSelectState(this);
        this.state = this.directionSelectState; // 外からはstateのSetterで変更してもらう。
    }
    Universe.prototype.addPlanet = function (planet) {
        this.planets.push(planet);
        this.scene.append(planet.entity);
    };
    Object.defineProperty(Universe.prototype, "state", {
        get: function () { return this._state; },
        set: function (state) {
            this._state = state;
            this.state.stateChanged();
        },
        enumerable: false,
        configurable: true
    });
    Universe.prototype.update = function () {
        this.state.update();
    };
    Universe.prototype.playerDrag = function (ev) {
        this.state.playerDrag(ev);
    };
    return Universe;
}());
// 多体の重力を計算
function calcGravity(planets, mainPlanetIdx) {
    if (planets === void 0) { planets = new Array(); }
    if (mainPlanetIdx === void 0) { mainPlanetIdx = 0; }
    var acceleration = new Acceleration(0.0, 0.0); // 成分に分けてreturn
    var mainPlanet = planets[mainPlanetIdx];
    planets.forEach(function (subPlanet, planetIdx) {
        if (planetIdx == mainPlanetIdx) {
            return;
        }
        var deltaX = subPlanet.pos.x - mainPlanet.pos.x;
        var deltaY = subPlanet.pos.y - mainPlanet.pos.y;
        var distance = Math.sqrt(Math.pow(deltaX, 2.0) + Math.pow(deltaY, 2.0));
        var constantOfGravitation = PhysicalConstant.ConstantOfGravitation;
        var gravity = constantOfGravitation * mainPlanet.mass * subPlanet.mass / Math.pow(distance, 2.0); // 万有引力
        acceleration.x += gravity * deltaX / distance;
        acceleration.y += gravity * deltaY / distance; // 成分に分けてreturn
    });
    return acceleration;
}
// meterが何pxに相当するか返します。
function meterToPx(meter) {
    var astroUnit = PhysicalConstant.AstroUnit; // 天文単位
    // 10AUを画面の端（短辺）として考えてみる。 
    return Math.floor(meter / 10 / astroUnit * Math.min(g.game.width, g.game.height));
}
function pxToMeter(px) {
    return px / meterToPx(1);
}
function main(param) {
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
        var astroUnit = PhysicalConstant.AstroUnit;
        var deltaTime = Setting.TimeStepSec;
        var planet1 = new Planet(40000.0, 6 * Math.pow(10.0, 20.0), new Pos(4.0 * astroUnit, 4 * astroUnit), new Velocity(0, 0.0), new Acceleration(0, 0));
        var planet2 = new Planet(40000.0, 6 * Math.pow(10.0, 20), new Pos(7.0 * astroUnit, 6.0 * astroUnit), new Velocity(0.0, -0.003 * astroUnit / deltaTime), new Acceleration(0.0, 0.0));
        var planet3 = new Planet(40000.0, 6 * Math.pow(10.0, 26), new Pos(6.0 * astroUnit, 5 * astroUnit), new Velocity(0.0, 0.0), new Acceleration(0.0, 0.0));
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
        var universe = new Universe(scene, [planet1, planet2, planet3], 10 * astroUnit, 10 * astroUnit); // 宇宙創造
        var directionLabel = new g.Label({
            scene: scene,
            font: font,
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
        player1.onPointDown.add(function () {
            directionLabel.text = "スワイプして方向を決めよう";
            directionLabel.invalidate();
            universe.state = universe.directionSelectState;
        });
        // ドラッグ量に応じて速度を決める
        player1.onPointMove.add(function (ev) {
            directionLabel.text = "スワイプして方向を決めよう";
            directionLabel.invalidate();
            universe.playerDrag(ev);
        });
        // マウスを離したらシミュレーション開始
        player1.onPointUp.add(function () {
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
module.exports = main;
