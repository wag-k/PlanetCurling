/**
 * SI単位系で物理計算に使用する定数です。
 */
export class PhysicalConstant {
	/** 1天文単位（m）です。 */
	static get AstroUnit(): number {
		return 149597870700;
	}

	/** Newtonの万有引力定数（m^3 kg^-1 s^-2）です。 */
	static get ConstantOfGravitation(): number {
		return 6.67430 * Math.pow(10, -11);
	}
}
