import {CpuSettings} from "./cpu_settings";
import {CpuDifficulty} from "./game_session";
import {calculateLaunchVelocity} from "./input_velocity";
import {Velocity} from "./motion";

/** 人間と同じ入力変換で生成した、決定論的なCPU投球候補です。 */
export class CpuShotCandidate {
	/** virtual dragのx成分（logical px）です。 */
	readonly virtualDragXPixels: number;
	/** virtual dragのy成分（logical px）です。 */
	readonly virtualDragYPixels: number;
	/** virtual dragの大きさ（logical px）です。 */
	readonly virtualDragMagnitudePixels: number;
	/** virtual drag角度（0以上2π未満、radian）です。 */
	readonly angleRadians: number;
	/** calculateLaunchVelocity()を通した本番用初速度（m/s）です。 */
	readonly velocity: Velocity;

	/** virtual dragと、人間操作と同じ変換結果を関連付けます。 */
	constructor(
		virtualDragXPixels: number,
		virtualDragYPixels: number,
		virtualDragMagnitudePixels: number,
		angleRadians: number,
		velocity: Velocity
	) {
		this.virtualDragXPixels = virtualDragXPixels;
		this.virtualDragYPixels = virtualDragYPixels;
		this.virtualDragMagnitudePixels = virtualDragMagnitudePixels;
		this.angleRadians = angleRadians;
		this.velocity = velocity;
	}

	/** tie-breakで使用する初速度の大きさ（m/s）を返します。 */
	get speedMetresPerSecond(): number {
		return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
	}
}

/** 360度のvirtual drag gridとglobal best周辺の局所gridを生成します。 */
export class CpuCandidateGenerator {
	/** 入力速度換算に使う物理世界幅（m）です。 */
	readonly worldWidthMetres: number;
	/** 入力速度換算に使うAkashic論理画面幅（px）です。 */
	readonly viewportWidthPixels: number;
	/** CPUが探索できるvirtual drag上限（logical px）です。 */
	readonly maxVirtualDragPixels: number;

	/** 人間のcalculateLaunchVelocity()と共有する探索空間を生成します。 */
	constructor(
		worldWidthMetres: number,
		viewportWidthPixels: number,
		maxVirtualDragPixels: number = CpuSettings.MaxVirtualDragPixels
	) {
		this.worldWidthMetres = worldWidthMetres;
		this.viewportWidthPixels = viewportWidthPixels;
		this.maxVirtualDragPixels = maxVirtualDragPixels;
	}

	/** 難易度の方向数×速度数を、angle優先の決定的な順序で返します。 */
	generateGlobalCandidates(difficulty: CpuDifficulty): CpuShotCandidate[] {
		const config = CpuSettings.getCandidateConfig(difficulty);
		const candidates: CpuShotCandidate[] = [];
		for (let directionIndex: number = 0; directionIndex < config.directionCount; directionIndex += 1) {
			const angle: number = 2 * Math.PI * directionIndex / config.directionCount;
			for (let speedIndex: number = 1; speedIndex <= config.speedCount; speedIndex += 1) {
				candidates.push(this.createCandidate(angle,
					this.maxVirtualDragPixels * speedIndex / config.speedCount));
			}
		}
		return candidates;
	}

	/** global bestのangle・drag magnitude周辺を細分化し、既存候補との重複を除いて返します。 */
	generateRefinementCandidates(
		difficulty: CpuDifficulty,
		globalBest: CpuShotCandidate,
		existingCandidates: CpuShotCandidate[]
	): CpuShotCandidate[] {
		const config = CpuSettings.getCandidateConfig(difficulty);
		if (config.refinementGridSize <= 0) return [];
		const size: number = config.refinementGridSize;
		const half: number = Math.floor(size / 2);
		const angleInterval: number = 2 * Math.PI / config.directionCount / size;
		const speedInterval: number = this.maxVirtualDragPixels / config.speedCount / size;
		let minimumMagnitude: number = globalBest.virtualDragMagnitudePixels - half * speedInterval;
		let maximumMagnitude: number = globalBest.virtualDragMagnitudePixels + half * speedInterval;
		if (minimumMagnitude <= 0) {
			maximumMagnitude += speedInterval - minimumMagnitude;
			minimumMagnitude = speedInterval;
		}
		if (maximumMagnitude > this.maxVirtualDragPixels) {
			minimumMagnitude -= maximumMagnitude - this.maxVirtualDragPixels;
			maximumMagnitude = this.maxVirtualDragPixels;
		}
		const seen: {[key: string]: boolean} = {};
		existingCandidates.forEach((candidate: CpuShotCandidate): void => {
			seen[this.createKey(candidate)] = true;
		});
		const candidates: CpuShotCandidate[] = [];
		for (let angleOffset: number = -half; angleOffset <= half; angleOffset += 1) {
			const angle: number = this.normalizeAngle(globalBest.angleRadians + angleOffset * angleInterval);
			for (let speedOffset: number = 0; speedOffset < size; speedOffset += 1) {
				const magnitude: number = minimumMagnitude + speedOffset *
					(maximumMagnitude - minimumMagnitude) / (size - 1);
				const candidate: CpuShotCandidate = this.createCandidate(angle, magnitude);
				const key: string = this.createKey(candidate);
				if (seen[key]) continue;
				seen[key] = true;
				candidates.push(candidate);
			}
		}
		return candidates;
	}

	/** 指定極座標をvirtual dragへ変換し、既存入力関数だけで候補速度を生成します。 */
	private createCandidate(angleRadians: number, magnitudePixels: number): CpuShotCandidate {
		const dragX: number = Math.cos(angleRadians) * magnitudePixels;
		const dragY: number = Math.sin(angleRadians) * magnitudePixels;
		return new CpuShotCandidate(
			dragX,
			dragY,
			magnitudePixels,
			this.normalizeAngle(angleRadians),
			calculateLaunchVelocity(dragX, dragY, this.worldWidthMetres, this.viewportWidthPixels)
		);
	}

	/** 浮動小数点の微小差を無視してvirtual drag重複を判定するkeyを返します。 */
	private createKey(candidate: CpuShotCandidate): string {
		return candidate.virtualDragXPixels.toFixed(8) + ":" + candidate.virtualDragYPixels.toFixed(8);
	}

	/** 任意角度を0以上2π未満へ正規化します。 */
	private normalizeAngle(angleRadians: number): number {
		const fullTurn: number = 2 * Math.PI;
		return ((angleRadians % fullTurn) + fullTurn) % fullTurn;
	}
}
