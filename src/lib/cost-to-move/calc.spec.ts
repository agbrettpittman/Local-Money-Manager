import { describe, expect, it } from 'vitest';
import {
	calcAvailableCash,
	calcDurationMonths,
	calcFutureHomePrice,
	calcLoanAmount,
	calcMonthsSinceStart,
	calcMortgagePayment,
	calcMortgagePaymentForHome,
	calcMortgageStatus,
	calcNetProceeds,
	calcTotalMonthlyPayment,
	getEffectiveValue,
	isFutureActive,
	projectHome,
	projectInvestment,
	resolveActiveAssets
} from './calc';
import { defaultCostToMoveState, defaultHomeSelection } from './defaults';
import type { CostToMoveState, Home, Item } from '$lib/db/types';

const item = (id: string, name: string, kind: 'asset' | 'liability'): Item => ({
	id,
	name,
	kind,
	createdAt: '2026-01-01T00:00:00Z'
});

const baseState = (): CostToMoveState => defaultCostToMoveState();

const makeHome = (id: string, name: string, overrides: Partial<Home> = {}): Home => ({
	id,
	name,
	valueItemId: `${id}-value`,
	mortgageItemId: `${id}-mortgage`,
	sellingCostPercent: 7,
	mortgageRate: 6,
	mortgageYears: 30,
	createdAt: '2026-01-01T00:00:00Z',
	...overrides
});

const NOW = new Date('2026-05-01T00:00:00Z');

describe('calcMortgagePayment', () => {
	it('returns 0 for zero principal', () => {
		expect(calcMortgagePayment(0, 6, 30)).toBe(0);
	});
	it('returns simple division when rate is 0', () => {
		expect(calcMortgagePayment(360_000, 0, 30)).toBeCloseTo(1000, 5);
	});
	it('matches a known fixed-rate mortgage', () => {
		// $300k, 6%, 30y → ~$1,798.65/mo
		expect(calcMortgagePayment(300_000, 6, 30)).toBeCloseTo(1798.65, 1);
	});
});

describe('calcDurationMonths / isFutureActive', () => {
	it('returns 0 when futureMode is disabled', () => {
		const s = { ...baseState(), futureMode: { ...baseState().futureMode, moveDate: '2027-05-01' } };
		expect(calcDurationMonths(s, NOW)).toBe(0);
		expect(isFutureActive(s, NOW)).toBe(false);
	});
	it('returns months between now and moveDate when enabled', () => {
		const s = {
			...baseState(),
			futureMode: { ...baseState().futureMode, enabled: true, moveDate: '2027-05-01' }
		};
		expect(calcDurationMonths(s, NOW)).toBe(12);
		expect(isFutureActive(s, NOW)).toBe(true);
	});
	it('returns 0 if moveDate is in the past', () => {
		const s = {
			...baseState(),
			futureMode: { ...baseState().futureMode, enabled: true, moveDate: '2025-01-01' }
		};
		expect(calcDurationMonths(s, NOW)).toBe(0);
	});
});

describe('getEffectiveValue', () => {
	it('returns base value when futureMode disabled', () => {
		const s = { ...baseState(), housePrice: 400_000 };
		expect(getEffectiveValue(s, 'housePrice')).toBe(400_000);
	});
	it('returns override value when set and futureMode enabled', () => {
		const s: CostToMoveState = {
			...baseState(),
			housePrice: 400_000,
			futureMode: { ...baseState().futureMode, enabled: true, moveDate: '2027-05-01' },
			futureOverrides: {
				...baseState().futureOverrides,
				housePrice: { isOverridden: true, futureValue: 450_000 }
			}
		};
		expect(getEffectiveValue(s, 'housePrice')).toBe(450_000);
	});
});

describe('projectInvestment', () => {
	it('grows with no contributions', () => {
		// $10k @ 12% APR for 12 months ≈ 10k * 1.01^12 ≈ 11268.25
		const grown = projectInvestment(
			10_000,
			{ annualReturnRate: 12, contributionAmount: 0, contributionFrequency: 'monthly' },
			12
		);
		expect(grown).toBeCloseTo(11268.25, 1);
	});
	it('handles zero return rate (additive contributions)', () => {
		const grown = projectInvestment(
			1000,
			{ annualReturnRate: 0, contributionAmount: 100, contributionFrequency: 'monthly' },
			12
		);
		expect(grown).toBeCloseTo(1000 + 1200, 5);
	});
});

describe('calcFutureHomePrice', () => {
	it('compounds at the inflation rate over the duration', () => {
		const s: CostToMoveState = {
			...baseState(),
			housePrice: 500_000,
			futureMode: {
				enabled: true,
				moveDate: '2027-05-01',
				homePriceInflationRate: 5,
				currentHomeGrowthRate: 3
			}
		};
		// 5%/yr for 12 months → 525000
		expect(calcFutureHomePrice(s, NOW)).toBeCloseTo(525_000, 0);
	});
});

describe('projectHome', () => {
	it('returns base value/mortgage when not in future mode', () => {
		const home = makeHome('h1', 'Primary');
		const latestAmounts = { 'h1-value': 500_000, 'h1-mortgage': 200_000 };
		const projection = projectHome(home, baseState(), latestAmounts, NOW);
		expect(projection.value).toBe(500_000);
		expect(projection.mortgage).toBe(200_000);
		expect(projection.sellingCost).toBe(500_000 * 0.07);
		// 500k - 200k - 35k = 265k
		expect(projection.netProceeds).toBe(265_000);
	});

	it('amortizes mortgage and grows value in future mode', () => {
		const home = makeHome('h1', 'Primary', { mortgageRate: 6, mortgageYears: 30 });
		const latestAmounts = { 'h1-value': 500_000, 'h1-mortgage': 200_000 };
		const state: CostToMoveState = {
			...baseState(),
			futureMode: {
				enabled: true,
				moveDate: '2027-05-01',
				homePriceInflationRate: 5,
				currentHomeGrowthRate: 4
			}
		};
		const projection = projectHome(home, state, latestAmounts, NOW);
		// Value compounds at 4% over 12 months → 520k
		expect(projection.value).toBeCloseTo(520_000, 0);
		// Mortgage amortizes down (small change over 12 months but always less than starting balance)
		expect(projection.mortgage).toBeGreaterThan(195_000);
		expect(projection.mortgage).toBeLessThan(200_000);
	});
});

describe('calcMonthsSinceStart', () => {
	it('returns 0 when start date is in the future', () => {
		expect(calcMonthsSinceStart('2027-01-01', NOW)).toBe(0);
	});
	it('returns months between start and now', () => {
		expect(calcMonthsSinceStart('2024-05-01', NOW)).toBe(24);
	});
	it('returns 0 for invalid date strings', () => {
		expect(calcMonthsSinceStart('not-a-date', NOW)).toBe(0);
	});
});

describe('calcMortgagePaymentForHome', () => {
	it('falls back to fresh-loan payment when start date is missing', () => {
		const home = makeHome('h1', 'Primary', { mortgageRate: 6, mortgageYears: 30 });
		// $300k @ 6% / 30y → ~$1798.65/mo
		expect(calcMortgagePaymentForHome(home, 300_000, NOW)).toBeCloseTo(1798.65, 1);
	});

	it('derives original principal from start date so payment matches the original schedule', () => {
		// Original: $300k @ 6% / 30y → $1798.65/mo. After 60 months (5y), balance ≈ $279,162.
		// With start date set, the payment should still come out to ~$1798.65 even though
		// the current balance is lower than the original principal.
		const home = makeHome('h1', 'Primary', {
			mortgageRate: 6,
			mortgageYears: 30,
			mortgageStartDate: '2021-05-01'
		});
		// 60 months elapsed at NOW (2026-05-01).
		const balance = 279_162.79;
		expect(calcMortgagePaymentForHome(home, balance, NOW)).toBeCloseTo(1798.65, 0);
	});
});

describe('calcMortgageStatus', () => {
	it('returns null when start date is missing', () => {
		const home = makeHome('h1', 'Primary');
		expect(calcMortgageStatus(home, 200_000, NOW)).toBeNull();
	});

	it('reports months elapsed/remaining and a payoff date', () => {
		const home = makeHome('h1', 'Primary', {
			mortgageRate: 6,
			mortgageYears: 30,
			mortgageStartDate: '2021-05-01'
		});
		const status = calcMortgageStatus(home, 279_162, NOW);
		expect(status).not.toBeNull();
		expect(status!.monthsElapsed).toBe(60);
		expect(status!.totalMonths).toBe(360);
		expect(status!.monthsRemaining).toBe(300);
		expect(status!.percentComplete).toBeCloseTo((60 / 360) * 100, 5);
		expect(status!.payoffDate.startsWith('2051-05')).toBe(true);
		expect(status!.originalPrincipal).toBeCloseTo(300_000, -3);
	});

	it('clamps months elapsed at the total term when overdue', () => {
		const home = makeHome('h1', 'Primary', {
			mortgageRate: 5,
			mortgageYears: 15,
			mortgageStartDate: '2000-01-01'
		});
		const status = calcMortgageStatus(home, 0, NOW);
		expect(status!.monthsElapsed).toBe(180);
		expect(status!.monthsRemaining).toBe(0);
		expect(status!.percentComplete).toBe(100);
	});
});

describe('calcNetProceeds', () => {
	it('returns 0 when no homes are selected', () => {
		const home = makeHome('h1', 'Primary');
		const state: CostToMoveState = {
			...baseState(),
			homeSelections: { h1: { enabled: false } }
		};
		const latestAmounts = { 'h1-value': 500_000, 'h1-mortgage': 200_000 };
		expect(calcNetProceeds(state, [home], latestAmounts, NOW)).toBe(0);
	});

	it('sums net proceeds for enabled homes and subtracts shared expenses', () => {
		const home = makeHome('h1', 'Primary');
		const state: CostToMoveState = {
			...baseState(),
			homeSelections: { h1: { enabled: true } },
			currentHomeExpenses: [
				{
					id: 'r1',
					name: 'roof',
					amount: 5000,
					hasGrowth: false,
					growthConfig: { annualGrowthRate: 0, growthFrequency: 'yearly' }
				}
			]
		};
		const latestAmounts = { 'h1-value': 500_000, 'h1-mortgage': 200_000 };
		// 500k - 200k - 35k - 5k = 260k
		expect(calcNetProceeds(state, [home], latestAmounts, NOW)).toBe(260_000);
	});

	it('combines proceeds across multiple selected homes', () => {
		const a = makeHome('a', 'Primary', { sellingCostPercent: 0 });
		const b = makeHome('b', 'Cottage', { sellingCostPercent: 0 });
		const state: CostToMoveState = {
			...baseState(),
			homeSelections: { a: { enabled: true }, b: { enabled: true } }
		};
		const latestAmounts = {
			'a-value': 400_000,
			'a-mortgage': 100_000,
			'b-value': 200_000,
			'b-mortgage': 0
		};
		// 300k + 200k = 500k
		expect(calcNetProceeds(state, [a, b], latestAmounts, NOW)).toBe(500_000);
	});

	it('skips archived homes even if selection is enabled', () => {
		const home = makeHome('h1', 'Primary', { archivedAt: '2026-04-01T00:00:00Z' });
		const state: CostToMoveState = {
			...baseState(),
			homeSelections: { h1: { enabled: true } }
		};
		const latestAmounts = { 'h1-value': 500_000, 'h1-mortgage': 0 };
		expect(calcNetProceeds(state, [home], latestAmounts, NOW)).toBe(0);
	});
});

describe('asset/expense resolution and aggregates', () => {
	const items: Item[] = [
		item('a1', 'Brokerage', 'asset'),
		item('a2', 'Cash', 'asset'),
		item('l1', 'CreditCard', 'liability')
	];
	const latestAmounts = { a1: 50_000, a2: 10_000, l1: 2_000 };

	const disabledAssetSel = {
		enabled: false,
		isInvestment: false,
		investmentConfig: {
			annualReturnRate: 7,
			contributionAmount: 0,
			contributionFrequency: 'monthly' as const
		}
	};

	it('resolveActiveAssets uses latest amount when no override', () => {
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {
				a1: { ...disabledAssetSel, enabled: true },
				a2: disabledAssetSel
			}
		};
		const resolved = resolveActiveAssets(s, items, latestAmounts);
		expect(resolved).toHaveLength(1);
		expect(resolved[0].amount).toBe(50_000);
	});

	it('resolveActiveAssets honors amountOverride', () => {
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {
				a1: { ...disabledAssetSel, enabled: true, amountOverride: 40_000 },
				a2: disabledAssetSel
			}
		};
		expect(resolveActiveAssets(s, items, latestAmounts)[0].amount).toBe(40_000);
	});

	it('resolveActiveAssets defaults to enabled when no selection record exists', () => {
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {}
		};
		const resolved = resolveActiveAssets(s, items, latestAmounts);
		// a1 + a2 (l1 is liability, excluded). Default-on matches the AssetSelectionList UI.
		expect(resolved).toHaveLength(2);
		expect(resolved.map((r) => r.amount).sort()).toEqual([10_000, 50_000]);
	});

	it('resolveActiveAssets excludes home-managed items', () => {
		const homeItem: Item = { ...item('a3', 'Primary', 'asset'), homeId: 'h1' };
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {
				a3: {
					enabled: true,
					isInvestment: false,
					investmentConfig: {
						annualReturnRate: 7,
						contributionAmount: 0,
						contributionFrequency: 'monthly'
					}
				}
			}
		};
		expect(resolveActiveAssets(s, [homeItem], { a3: 500_000 })).toEqual([]);
	});

	it('calcAvailableCash sums enabled assets minus enabled liabilities and ad-hoc expenses', () => {
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {
				a1: {
					enabled: true,
					isInvestment: false,
					investmentConfig: {
						annualReturnRate: 7,
						contributionAmount: 0,
						contributionFrequency: 'monthly'
					}
				},
				a2: {
					enabled: true,
					isInvestment: false,
					investmentConfig: {
						annualReturnRate: 7,
						contributionAmount: 0,
						contributionFrequency: 'monthly'
					}
				}
			},
			expenseSelections: {
				l1: {
					enabled: true,
					hasGrowth: false,
					growthConfig: { annualGrowthRate: 0, growthFrequency: 'yearly' }
				}
			},
			adHocExpenses: [
				{
					id: 'x',
					name: 'Moving truck',
					amount: 5000,
					hasGrowth: false,
					growthConfig: { annualGrowthRate: 0, growthFrequency: 'yearly' }
				}
			]
		};
		// 60k assets - 2k credit card - 5k moving = 53k
		expect(calcAvailableCash(s, items, [], latestAmounts, NOW)).toBe(53_000);
	});

	it('calcAvailableCash includes net proceeds from selected homes', () => {
		const home = makeHome('h1', 'Primary');
		const s: CostToMoveState = {
			...baseState(),
			homeSelections: { h1: defaultHomeSelection() }
		};
		const homeAmounts = { 'h1-value': 500_000, 'h1-mortgage': 200_000 };
		// no journal items, no expenses → 500k - 200k - 35k = 265k
		expect(calcAvailableCash(s, [], [home], homeAmounts, NOW)).toBe(265_000);
	});

	it('calcLoanAmount = max(0, housePrice - availableCash)', () => {
		const s: CostToMoveState = {
			...baseState(),
			housePrice: 500_000,
			assetSelections: {
				a1: {
					enabled: true,
					isInvestment: false,
					investmentConfig: {
						annualReturnRate: 7,
						contributionAmount: 0,
						contributionFrequency: 'monthly'
					}
				},
				a2: disabledAssetSel
			}
		};
		// 500k - 50k = 450k (a2 explicitly disabled)
		expect(calcLoanAmount(s, items, [], latestAmounts, NOW)).toBe(450_000);
	});

	it('calcLoanAmount auto-includes assets without selection records (default enabled)', () => {
		const s: CostToMoveState = {
			...baseState(),
			housePrice: 500_000,
			assetSelections: {}
		};
		// 500k - (50k + 10k) = 440k
		expect(calcLoanAmount(s, items, [], latestAmounts, NOW)).toBe(440_000);
	});

	it('calcTotalMonthlyPayment combines P&I + taxes + insurance', () => {
		const s: CostToMoveState = {
			...baseState(),
			housePrice: 360_000,
			interestRate: 0,
			loanYears: 30,
			propertyTaxRate: 1.2,
			monthlyInsurance: 100
		};
		// loanAmount = 360k (no assets), P&I (rate=0) = 360k/360 = 1000, tax = 360k * 0.012 / 12 = 360, ins = 100
		expect(calcTotalMonthlyPayment(s, [], [], {}, NOW)).toBeCloseTo(1000 + 360 + 100, 5);
	});

	it('does not include archived items even when selection record exists', () => {
		const itemsArchived: Item[] = [
			{ ...item('a1', 'Brokerage', 'asset'), archivedAt: '2026-01-15T00:00:00Z' }
		];
		const s: CostToMoveState = {
			...baseState(),
			assetSelections: {
				a1: {
					enabled: true,
					isInvestment: false,
					investmentConfig: {
						annualReturnRate: 7,
						contributionAmount: 0,
						contributionFrequency: 'monthly'
					}
				}
			}
		};
		expect(resolveActiveAssets(s, itemsArchived, latestAmounts)).toEqual([]);
	});
});
