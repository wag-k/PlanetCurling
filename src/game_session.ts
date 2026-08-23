/** 1台での2人対戦と、BlueをCPUが担当する1人用対戦を表します。 */
export enum GameMode {
	/** RedとBlueの両方を人間が操作する従来モードです。 */
	LocalTwoPlayer = "LocalTwoPlayer",
	/** Redを人間、BlueをCPUが操作するモードです。 */
	VsCpu = "VsCpu"
}

/** CPU探索の候補密度だけを切り替える難易度です。物理精度には影響しません。 */
export enum CpuDifficulty {
	/** 36候補を粗く探索する難易度です。 */
	Easy = "Easy",
	/** 64候補と局所探索を行う推奨難易度です。 */
	Normal = "Normal",
	/** 120候補と細かな局所探索を行う難易度です。 */
	Hard = "Hard"
}

/** ゲームルールや物理設定から独立して、Rematch後も維持する対戦設定です。 */
export class GameSessionConfig {
	/** 現在選択中の対戦モードです。 */
	gameMode: GameMode;
	/** Vs CPUで使用する候補探索難易度です。 */
	cpuDifficulty: CpuDifficulty;

	/** 初期推奨値をVs CPU / Normalとして設定を生成します。 */
	constructor(gameMode: GameMode = GameMode.VsCpu, cpuDifficulty: CpuDifficulty = CpuDifficulty.Normal) {
		this.gameMode = gameMode;
		this.cpuDifficulty = cpuDifficulty;
	}

	/** Mode Selectionで選ばれた値を、同じ設定インスタンスへ反映します。 */
	update(gameMode: GameMode, cpuDifficulty: CpuDifficulty): void {
		this.gameMode = gameMode;
		this.cpuDifficulty = cpuDifficulty;
	}
}

/** HUD用に難易度を短い英大文字へ変換します。 */
export function formatCpuDifficulty(difficulty: CpuDifficulty): string {
	return difficulty.toUpperCase();
}
