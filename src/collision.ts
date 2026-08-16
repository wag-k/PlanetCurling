import {Pos} from "./motion";
import {PhysicsWorld, PhysicsWorldClone} from "./physics_world";
import {Planet} from "./planet";

/** ゲーム進行へ通知する衝突の種類です。 */
export enum CollisionEventKind {
	/** 投石同士が反発したことを表します。 */
	StoneStone = "stone-stone",
	/** 投石が中央天体へ吸収されたことを表します。 */
	StoneCentralBody = "stone-central-body"
}

/** 物理層からゲーム進行・描画層へ渡す衝突通知です。 */
export class CollisionEvent {
	/** 発生した衝突の種類です。 */
	readonly kind: CollisionEventKind;
	/** 衝突した、または吸収された投石です。 */
	readonly firstBody: Planet;
	/** 投石同士の相手、または中央天体です。 */
	readonly secondBody: Planet;
	/** 衝突位置（m）の独立した値です。 */
	readonly position: Pos;
	/** 6時間base step開始から衝突までの経過時間（s）です。 */
	readonly timeFromStepStartSeconds: number;

	/** 衝突通知を生成します。 */
	constructor(kind: CollisionEventKind, firstBody: Planet, secondBody: Planet, position: Pos, timeFromStepStartSeconds: number = 0) {
		this.kind = kind;
		this.firstBody = firstBody;
		this.secondBody = secondBody;
		this.position = position.clone();
		this.timeFromStepStartSeconds = timeFromStepStartSeconds;
	}
}

/** 仮積分区間から検出した、解決前のtime-of-impact候補です。 */
export class CollisionCandidate {
	/** 解決する衝突種別です。 */
	readonly kind: CollisionEventKind;
	/** 区間開始を0、終了を1とした最初の接触比率です。 */
	readonly timeRatio: number;
	/** swept-circle判定が返した接触情報です。 */
	readonly contact: SweptCollisionContact;
	/** 同時刻候補を安定して並べるbody順です。 */
	readonly stableOrder: number;

	/** 決定的な候補選択に必要な値を保持します。 */
	constructor(kind: CollisionEventKind, contact: SweptCollisionContact, stableOrder: number) {
		this.kind = kind;
		this.timeRatio = contact.timeRatio;
		this.contact = contact;
		this.stableOrder = stableOrder;
	}
}

/** 1物理ステップ開始時の天体位置を保持します。 */
export class BodyPositionSnapshot {
	/** 対象天体です。 */
	readonly body: Planet;
	/** ステップ開始時の位置です。 */
	readonly position: Pos;

	/** 天体と複製済み位置を対応付けます。 */
	constructor(body: Planet, position: Pos) {
		this.body = body;
		this.position = position.clone();
	}
}

/** 連続衝突判定で得た円同士の最初の接触情報です。 */
export class SweptCollisionContact {
	/** 1番目の天体です。 */
	readonly firstBody: Planet;
	/** 2番目の天体です。 */
	readonly secondBody: Planet;
	/** ステップ開始を0、終了を1とした接触時刻です。 */
	readonly timeRatio: number;
	/** 1番目から2番目を向く接触法線のx成分です。 */
	readonly normalX: number;
	/** 1番目から2番目を向く接触法線のy成分です。 */
	readonly normalY: number;
	/** 1番目の接触時位置です。 */
	readonly firstContactPosition: Pos;
	/** 2番目の接触時位置です。 */
	readonly secondContactPosition: Pos;
	/** ステップ開始時点ですでに重なっていたかを示します。 */
	readonly startedOverlapping: boolean;

	/** 接触情報を生成します。 */
	constructor(
		firstBody: Planet,
		secondBody: Planet,
		timeRatio: number,
		normalX: number,
		normalY: number,
		firstContactPosition: Pos,
		secondContactPosition: Pos,
		startedOverlapping: boolean
	) {
		this.firstBody = firstBody;
		this.secondBody = secondBody;
		this.timeRatio = timeRatio;
		this.normalX = normalX;
		this.normalY = normalY;
		this.firstContactPosition = firstContactPosition;
		this.secondContactPosition = secondContactPosition;
		this.startedOverlapping = startedOverlapping;
	}

	/** 2円の接触点の中間を返します。 */
	getMidpoint(): Pos {
		return new Pos(
			(this.firstContactPosition.x + this.secondContactPosition.x) / 2,
			(this.firstContactPosition.y + this.secondContactPosition.y) / 2
		);
	}
}

/** Akashic Engineに依存せず、移動する円同士の接触時刻を求めます。 */
export class CollisionDetector {
	/**
	 * ステップ前後の位置から2円の最初の接触を二次方程式で求めます。
	 * @param firstBody 1番目の天体
	 * @param secondBody 2番目の天体
	 * @param firstStart 1番目の開始位置
	 * @param secondStart 2番目の開始位置
	 * @param firstRadius 1番目の衝突半径
	 * @param secondRadius 2番目の衝突半径
	 */
	static detectSweptCircle(
		firstBody: Planet,
		secondBody: Planet,
		firstStart: Pos,
		secondStart: Pos,
		firstRadius: number,
		secondRadius: number
	): SweptCollisionContact | undefined {
		const relativeStartX: number = secondStart.x - firstStart.x;
		const relativeStartY: number = secondStart.y - firstStart.y;
		const firstMoveX: number = firstBody.pos.x - firstStart.x;
		const firstMoveY: number = firstBody.pos.y - firstStart.y;
		const relativeMoveX: number = secondBody.pos.x - secondStart.x - firstMoveX;
		const relativeMoveY: number = secondBody.pos.y - secondStart.y - firstMoveY;
		const radiusSum: number = firstRadius + secondRadius;
		const constant: number = relativeStartX * relativeStartX + relativeStartY * relativeStartY - radiusSum * radiusSum;
		const startedOverlapping: boolean = constant <= 0;
		let timeRatio: number = 0;

		if (!startedOverlapping) {
			const quadratic: number = relativeMoveX * relativeMoveX + relativeMoveY * relativeMoveY;
			if (quadratic <= 0) {
				return undefined;
			}
			const linear: number = 2 * (relativeStartX * relativeMoveX + relativeStartY * relativeMoveY);
			const discriminant: number = linear * linear - 4 * quadratic * constant;
			if (discriminant < 0) {
				return undefined;
			}
			timeRatio = (-linear - Math.sqrt(discriminant)) / (2 * quadratic);
			if (timeRatio < 0 || timeRatio > 1) {
				return undefined;
			}
		}

		const firstContact: Pos = new Pos(
			firstStart.x + firstMoveX * timeRatio,
			firstStart.y + firstMoveY * timeRatio
		);
		const secondContact: Pos = new Pos(
			secondStart.x + (secondBody.pos.x - secondStart.x) * timeRatio,
			secondStart.y + (secondBody.pos.y - secondStart.y) * timeRatio
		);
		const normal: {x: number; y: number} = CollisionDetector.createNormal(
			firstBody,
			secondBody,
			secondContact.x - firstContact.x,
			secondContact.y - firstContact.y
		);
		return new SweptCollisionContact(
			firstBody,
			secondBody,
			timeRatio,
			normal.x,
			normal.y,
			firstContact,
			secondContact,
			startedOverlapping
		);
	}

	/** 距離が0でも有限値となる接触法線を生成します。 */
	private static createNormal(firstBody: Planet, secondBody: Planet, deltaX: number, deltaY: number): {x: number; y: number} {
		const distance: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		if (distance > 0) {
			return {x: deltaX / distance, y: deltaY / distance};
		}
		const relativeVelocityX: number = secondBody.velocity.x - firstBody.velocity.x;
		const relativeVelocityY: number = secondBody.velocity.y - firstBody.velocity.y;
		const relativeSpeed: number = Math.sqrt(
			relativeVelocityX * relativeVelocityX + relativeVelocityY * relativeVelocityY
		);
		if (relativeSpeed > 0) {
			return {x: -relativeVelocityX / relativeSpeed, y: -relativeVelocityY / relativeSpeed};
		}
		return {x: 1, y: 0};
	}
}

/** 接触情報に対して反発インパルスとめり込み補正を適用します。 */
export class CollisionResolver {
	/**
	 * 質量差を考慮して2天体を反発させ、実際にインパルスを加えた場合はtrueを返します。
	 * @param contact 検出済みの接触
	 * @param physicsStepSeconds 物理固定dt
	 * @param combinedRadius 2円の衝突半径合計
	 * @param restitution 反発係数
	 */
	static resolveStoneCollision(
		contact: SweptCollisionContact,
		physicsStepSeconds: number,
		combinedRadius: number,
		restitution: number
	): boolean {
		const first: Planet = contact.firstBody;
		const second: Planet = contact.secondBody;
		if (first.mass <= 0 || second.mass <= 0) {
			return false;
		}
		if (!contact.startedOverlapping) {
			first.pos.x = contact.firstContactPosition.x;
			first.pos.y = contact.firstContactPosition.y;
			second.pos.x = contact.secondContactPosition.x;
			second.pos.y = contact.secondContactPosition.y;
		}

		const relativeVelocityX: number = second.velocity.x - first.velocity.x;
		const relativeVelocityY: number = second.velocity.y - first.velocity.y;
		const velocityAlongNormal: number = relativeVelocityX * contact.normalX + relativeVelocityY * contact.normalY;
		let appliedImpulse: boolean = false;
		if (velocityAlongNormal < 0) {
			const inverseFirstMass: number = 1 / first.mass;
			const inverseSecondMass: number = 1 / second.mass;
			const impulseMagnitude: number = -(1 + restitution) * velocityAlongNormal /
				(inverseFirstMass + inverseSecondMass);
			const impulseX: number = impulseMagnitude * contact.normalX;
			const impulseY: number = impulseMagnitude * contact.normalY;
			first.velocity.x -= impulseX * inverseFirstMass;
			first.velocity.y -= impulseY * inverseFirstMass;
			second.velocity.x += impulseX * inverseSecondMass;
			second.velocity.y += impulseY * inverseSecondMass;
			appliedImpulse = true;
		}

		if (!contact.startedOverlapping) {
			const remainingSeconds: number = physicsStepSeconds * (1 - contact.timeRatio);
			first.pos.update(remainingSeconds, first.velocity);
			second.pos.update(remainingSeconds, second.velocity);
		}
		CollisionResolver.correctPenetration(first, second, contact.normalX, contact.normalY, combinedRadius);
		return appliedImpulse;
	}

	/** 逆質量比に応じて2天体を移動し、数値誤差や初期重なりを解消します。 */
	private static correctPenetration(
		first: Planet,
		second: Planet,
		normalX: number,
		normalY: number,
		combinedRadius: number
	): void {
		const deltaX: number = second.pos.x - first.pos.x;
		const deltaY: number = second.pos.y - first.pos.y;
		const distance: number = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
		const penetration: number = combinedRadius - distance;
		if (penetration <= 0) {
			return;
		}
		const inverseFirstMass: number = 1 / first.mass;
		const inverseSecondMass: number = 1 / second.mass;
		const inverseMassSum: number = inverseFirstMass + inverseSecondMass;
		const correctionX: number = normalX * penetration;
		const correctionY: number = normalY * penetration;
		first.pos.x -= correctionX * inverseFirstMass / inverseMassSum;
		first.pos.y -= correctionY * inverseFirstMass / inverseMassSum;
		second.pos.x += correctionX * inverseSecondMass / inverseMassSum;
		second.pos.y += correctionY * inverseSecondMass / inverseMassSum;
	}
}

/** 投石同士の反発と中央天体への吸収を1つの世界へ適用します。 */
export class CollisionSystem {
	/** 吸収判定を持つ中央天体です。 */
	readonly centralBody: Planet;
	/** 投石の衝突半径（m）です。 */
	readonly stoneRadiusMetres: number;
	/** 中央天体の吸収半径（m）です。 */
	readonly centralRadiusMetres: number;
	/** 投石同士の反発係数です。 */
	readonly restitution: number;
	/** 現在物理世界に参加している投石です。 */
	private readonly stoneBodies: Planet[];
	/** TOIの浮動小数点差を同時刻とみなす比率epsilonです。 */
	private static readonly TimeRatioEpsilon: number = 1e-10;

	/** 衝突設定と初期投石一覧を保持します。 */
	constructor(
		centralBody: Planet,
		stoneBodies: Planet[],
		stoneRadiusMetres: number,
		centralRadiusMetres: number,
		restitution: number
	) {
		this.centralBody = centralBody;
		this.stoneBodies = stoneBodies.slice();
		this.stoneRadiusMetres = stoneRadiusMetres;
		this.centralRadiusMetres = centralRadiusMetres;
		this.restitution = restitution;
	}

	/** 新しく生成された投石を衝突対象へ追加します。 */
	addStone(body: Planet): void {
		if (this.stoneBodies.indexOf(body) < 0) {
			this.stoneBodies.push(body);
		}
	}

	/** 現在位置を複製し、固定ステップ後の連続衝突判定に使える形で返します。 */
	capturePositions(): BodyPositionSnapshot[] {
		return [this.centralBody].concat(this.stoneBodies).map(
			(body: Planet): BodyPositionSnapshot => new BodyPositionSnapshot(body, body.pos)
		);
	}

	/** 積分前に中央天体内の投石を吸収し、初期重なりの反発を安全に処理します。 */
	resolveBeforeStep(world: PhysicsWorld): CollisionEvent[] {
		const snapshots: BodyPositionSnapshot[] = this.capturePositions();
		return this.resolve(world, snapshots, 0, true);
	}

	/** 積分後にステップ中のすり抜けを含む衝突を処理します。 */
	resolveAfterStep(
		world: PhysicsWorld,
		startSnapshots: BodyPositionSnapshot[],
		physicsStepSeconds: number
	): CollisionEvent[] {
		return this.resolve(world, startSnapshots, physicsStepSeconds, false);
	}

	/**
	 * 同じ仮積分区間にある中央吸収とStone反発を列挙し、最小TOIを返します。
	 * 同時刻は吸収、Stone反発、登録順の順で決定しPredictionとActualを一致させます。
	 */
	findEarliestCandidate(world: PhysicsWorld, startSnapshots: BodyPositionSnapshot[]): CollisionCandidate | undefined {
		const candidates: CollisionCandidate[] = [];
		const activeStones: Planet[] = this.stoneBodies.filter((body: Planet): boolean => world.bodies.indexOf(body) >= 0);
		activeStones.forEach((stone: Planet, stoneIndex: number): void => {
			const contact: SweptCollisionContact | undefined = this.detectContact(
				stone, this.centralBody, startSnapshots, this.stoneRadiusMetres, this.centralRadiusMetres
			);
			if (contact !== undefined) {
				candidates.push(new CollisionCandidate(CollisionEventKind.StoneCentralBody, contact, stoneIndex));
			}
		});
		for (let firstIndex: number = 0; firstIndex < activeStones.length; firstIndex += 1) {
			for (let secondIndex: number = firstIndex + 1; secondIndex < activeStones.length; secondIndex += 1) {
				const contact: SweptCollisionContact | undefined = this.detectContact(
					activeStones[firstIndex], activeStones[secondIndex], startSnapshots,
					this.stoneRadiusMetres, this.stoneRadiusMetres
				);
				if (contact !== undefined && this.isApproaching(contact)) {
					candidates.push(new CollisionCandidate(
						CollisionEventKind.StoneStone, contact, activeStones.length + firstIndex * activeStones.length + secondIndex
					));
				}
			}
		}
		return candidates.sort((first: CollisionCandidate, second: CollisionCandidate): number => {
			const timeDifference: number = first.timeRatio - second.timeRatio;
			if (Math.abs(timeDifference) > CollisionSystem.TimeRatioEpsilon) {
				return timeDifference;
			}
			if (first.kind !== second.kind) {
				return first.kind === CollisionEventKind.StoneCentralBody ? -1 : 1;
			}
			return first.stableOrder - second.stableOrder;
		})[0];
	}

	/** TOIまで再積分済みの世界へ候補を適用し、base step内の正確な秒時刻を通知します。 */
	resolveCandidate(world: PhysicsWorld, candidate: CollisionCandidate, timeFromStepStartSeconds: number): CollisionEvent | undefined {
		const contact: SweptCollisionContact = candidate.contact;
		if (candidate.kind === CollisionEventKind.StoneCentralBody) {
			contact.firstBody.pos.x = contact.firstContactPosition.x;
			contact.firstBody.pos.y = contact.firstContactPosition.y;
			world.removeBody(contact.firstBody);
			this.removeStone(contact.firstBody);
			return new CollisionEvent(candidate.kind, contact.firstBody, contact.secondBody,
				contact.firstContactPosition, timeFromStepStartSeconds);
		}
		const appliedImpulse: boolean = CollisionResolver.resolveStoneCollision(
			contact, 0, this.stoneRadiusMetres * 2, this.restitution
		);
		return appliedImpulse ? new CollisionEvent(candidate.kind, contact.firstBody, contact.secondBody,
			contact.getMidpoint(), timeFromStepStartSeconds) : undefined;
	}

	/** clone世界用に同一設定と対応するclone天体を持つ衝突系を生成します。 */
	cloneForWorld(worldClone: PhysicsWorldClone): CollisionSystem {
		return new CollisionSystem(
			worldClone.getClonedBody(this.centralBody),
			this.stoneBodies.map((body: Planet): Planet => worldClone.getClonedBody(body)),
			this.stoneRadiusMetres,
			this.centralRadiusMetres,
			this.restitution
		);
	}

	/** 衝突・吸収を中央天体優先で解決します。 */
	private resolve(
		world: PhysicsWorld,
		startSnapshots: BodyPositionSnapshot[],
		physicsStepSeconds: number,
		onlyInitialOverlap: boolean
	): CollisionEvent[] {
		const events: CollisionEvent[] = [];
		const activeStones: Planet[] = this.stoneBodies.slice();
		for (const stone of activeStones) {
			if (world.bodies.indexOf(stone) < 0) {
				continue;
			}
			const contact: SweptCollisionContact | undefined = this.detectContact(
				stone,
				this.centralBody,
				startSnapshots,
				this.stoneRadiusMetres,
				this.centralRadiusMetres
			);
			if (contact !== undefined && (!onlyInitialOverlap || contact.startedOverlapping)) {
				stone.pos.x = contact.firstContactPosition.x;
				stone.pos.y = contact.firstContactPosition.y;
				world.removeBody(stone);
				this.removeStone(stone);
				events.push(new CollisionEvent(
					CollisionEventKind.StoneCentralBody,
					stone,
					this.centralBody,
					contact.firstContactPosition
				));
			}
		}

		const remainingStones: Planet[] = this.stoneBodies.filter((body: Planet): boolean => world.bodies.indexOf(body) >= 0);
		for (let firstIndex: number = 0; firstIndex < remainingStones.length; firstIndex += 1) {
			for (let secondIndex: number = firstIndex + 1; secondIndex < remainingStones.length; secondIndex += 1) {
				const first: Planet = remainingStones[firstIndex];
				const second: Planet = remainingStones[secondIndex];
				const contact: SweptCollisionContact | undefined = this.detectContact(
					first,
					second,
					startSnapshots,
					this.stoneRadiusMetres,
					this.stoneRadiusMetres
				);
				if (contact === undefined || (onlyInitialOverlap && !contact.startedOverlapping)) {
					continue;
				}
				const appliedImpulse: boolean = CollisionResolver.resolveStoneCollision(
					contact,
					physicsStepSeconds,
					this.stoneRadiusMetres * 2,
					this.restitution
				);
				if (appliedImpulse) {
					events.push(new CollisionEvent(
						CollisionEventKind.StoneStone,
						first,
						second,
						contact.getMidpoint()
					));
				}
			}
		}
		return events;
	}

	/** 保存位置を参照して2天体の連続接触を判定します。 */
	private detectContact(
		first: Planet,
		second: Planet,
		snapshots: BodyPositionSnapshot[],
		firstRadius: number,
		secondRadius: number
	): SweptCollisionContact | undefined {
		const firstStart: Pos = this.findStartPosition(first, snapshots);
		const secondStart: Pos = this.findStartPosition(second, snapshots);
		return CollisionDetector.detectSweptCircle(first, second, firstStart, secondStart, firstRadius, secondRadius);
	}

	/** 指定天体の開始位置を返し、一覧にない場合は現在位置へフォールバックします。 */
	private findStartPosition(body: Planet, snapshots: BodyPositionSnapshot[]): Pos {
		const snapshot: BodyPositionSnapshot | undefined = snapshots.filter(
			(value: BodyPositionSnapshot): boolean => value.body === body
		)[0];
		return snapshot === undefined ? body.pos.clone() : snapshot.position;
	}

	/** 接触法線方向へ近づくStone接触だけをImpulse候補にします。 */
	private isApproaching(contact: SweptCollisionContact): boolean {
		const relativeVelocityX: number = contact.secondBody.velocity.x - contact.firstBody.velocity.x;
		const relativeVelocityY: number = contact.secondBody.velocity.y - contact.firstBody.velocity.y;
		return relativeVelocityX * contact.normalX + relativeVelocityY * contact.normalY < 0;
	}

	/** 吸収済み投石を衝突対象一覧から取り除きます。 */
	private removeStone(body: Planet): void {
		const index: number = this.stoneBodies.indexOf(body);
		if (index >= 0) {
			this.stoneBodies.splice(index, 1);
		}
	}
}
