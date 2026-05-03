import type { CostToMoveState, OverridableField } from '$lib/db/types';

const OVERRIDABLE_FIELDS: OverridableField[] = [
	'housePrice',
	'interestRate',
	'loanYears',
	'propertyTaxRate',
	'monthlyInsurance'
];

export function defaultCostToMoveState(): CostToMoveState {
	const futureOverrides = Object.fromEntries(
		OVERRIDABLE_FIELDS.map((f) => [f, { futureValue: null, isOverridden: false }])
	) as CostToMoveState['futureOverrides'];

	return {
		id: 'singleton',
		housePrice: 0,
		interestRate: 6.5,
		loanYears: 30,
		propertyTaxRate: 1.2,
		monthlyInsurance: 0,
		assetSelections: {},
		expenseSelections: {},
		homeSelections: {},
		adHocExpenses: [],
		currentHomeExpenses: [],
		futureMode: {
			enabled: false,
			moveDate: '',
			homePriceInflationRate: 3,
			currentHomeGrowthRate: 3
		},
		futureOverrides
	};
}

export function defaultAssetSelection() {
	return {
		enabled: true,
		isInvestment: false,
		investmentConfig: {
			annualReturnRate: 7,
			contributionAmount: 0,
			contributionFrequency: 'monthly' as const
		}
	};
}

export function defaultExpenseSelection() {
	return {
		enabled: false,
		hasGrowth: false,
		growthConfig: {
			annualGrowthRate: 2,
			growthFrequency: 'yearly' as const
		}
	};
}

export function defaultHomeSelection() {
	return { enabled: true };
}
