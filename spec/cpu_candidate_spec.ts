import {CpuCandidateGenerator, CpuShotCandidate} from "../src/cpu_candidate";
import {CpuSettings} from "../src/cpu_settings";
import {CpuDifficulty} from "../src/game_session";

/** テスト用の同じvirtual drag変換条件で候補generatorを生成します。 */
function createGenerator(): CpuCandidateGenerator {
	return new CpuCandidateGenerator(1000, 1280);
}

/** virtual dragを比較可能な文字列へ丸めます。 */
function candidateKey(candidate: CpuShotCandidate): string {
	return candidate.virtualDragXPixels.toFixed(8) + ":" + candidate.virtualDragYPixels.toFixed(8);
}

describe("CpuCandidateGenerator", (): void => {
	it.each([
		[CpuDifficulty.Easy, 36, 0, 36],
		[CpuDifficulty.Normal, 64, 8, 72],
		[CpuDifficulty.Hard, 120, 24, 144]
	])("%sはglobal %d件・refinement %d件・合計%d件になる", (
		difficulty: CpuDifficulty,
		globalCount: number,
		refinementCount: number,
		totalCount: number
	): void => {
		const generator: CpuCandidateGenerator = createGenerator();
		const globalCandidates: CpuShotCandidate[] = generator.generateGlobalCandidates(difficulty);
		const refinement: CpuShotCandidate[] = generator.generateRefinementCandidates(
			difficulty, globalCandidates[globalCandidates.length - 1], globalCandidates
		);

		expect(globalCandidates).toHaveLength(globalCount);
		expect(refinement).toHaveLength(refinementCount);
		expect(globalCandidates.concat(refinement)).toHaveLength(totalCount);
	});

	it.each([CpuDifficulty.Easy, CpuDifficulty.Normal, CpuDifficulty.Hard])(
		"%sは360度を等間隔で覆い、全virtual dragが0超300px以下になる",
		(difficulty: CpuDifficulty): void => {
			const generator: CpuCandidateGenerator = createGenerator();
			const candidates: CpuShotCandidate[] = generator.generateGlobalCandidates(difficulty);
			const config = CpuSettings.getCandidateConfig(difficulty);
			const angles: number[] = candidates.filter(
				(_candidate: CpuShotCandidate, index: number): boolean => index % config.speedCount === 0
			).map((candidate: CpuShotCandidate): number => candidate.angleRadians);

			expect(angles).toHaveLength(config.directionCount);
			expect(angles[0]).toBe(0);
			for (let index: number = 1; index < angles.length; index += 1) {
				expect(angles[index] - angles[index - 1]).toBeCloseTo(2 * Math.PI / config.directionCount, 12);
			}
			candidates.forEach((candidate: CpuShotCandidate): void => {
				expect(candidate.virtualDragMagnitudePixels).toBeGreaterThan(0);
				expect(candidate.virtualDragMagnitudePixels).toBeLessThanOrEqual(
					CpuSettings.MaxVirtualDragPixels
				);
			});
		}
	);

	it("refinementはglobalとの重複を除外し、same inputで同じsequenceを返す", (): void => {
		const firstGenerator: CpuCandidateGenerator = createGenerator();
		const secondGenerator: CpuCandidateGenerator = createGenerator();
		const firstGlobal: CpuShotCandidate[] = firstGenerator.generateGlobalCandidates(CpuDifficulty.Normal);
		const secondGlobal: CpuShotCandidate[] = secondGenerator.generateGlobalCandidates(CpuDifficulty.Normal);
		const first: CpuShotCandidate[] = firstGlobal.concat(firstGenerator.generateRefinementCandidates(
			CpuDifficulty.Normal, firstGlobal[0], firstGlobal
		));
		const second: CpuShotCandidate[] = secondGlobal.concat(secondGenerator.generateRefinementCandidates(
			CpuDifficulty.Normal, secondGlobal[0], secondGlobal
		));
		const keys: string[] = first.map(candidateKey);

		expect(new Set(keys).size).toBe(keys.length);
		expect(second.map(candidateKey)).toEqual(keys);
	});
});
