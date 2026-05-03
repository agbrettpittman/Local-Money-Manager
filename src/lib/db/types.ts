export type LineKind = 'asset' | 'liability';

export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Item {
	id: string;
	name: string;
	kind: LineKind;
	/** Optional parent for hierarchical grouping. One level of nesting only. */
	parentId?: string;
	/** Set when this item is auto-managed by a Home (the home value asset or its mortgage liability). */
	homeId?: string;
	archivedAt?: string;
	createdAt: string;
}

export interface Home {
	id: string;
	name: string;
	/** Item.id of the auto-created asset row representing this home's value. */
	valueItemId: string;
	/** Item.id of the auto-created liability row representing the mortgage balance. */
	mortgageItemId: string;
	sellingCostPercent: number;
	mortgageRate: number;
	/** Original loan term in years (used as the amortization horizon). */
	mortgageYears: number;
	/** ISO YYYY-MM-DD date the mortgage was originated. Optional — when set, enables payoff-progress display and a more accurate amortization-based payment derivation. */
	mortgageStartDate?: string;
	archivedAt?: string;
	createdAt: string;
}

export interface JournalLine {
	itemId: string;
	amount: number;
}

export interface JournalEntry {
	id: string;
	date: string;
	lines: JournalLine[];
	notes?: string;
	createdAt: string;
	updatedAt: string;
}

export interface InvestmentConfig {
	annualReturnRate: number;
	contributionAmount: number;
	contributionFrequency: Frequency;
}

export interface GrowthConfig {
	annualGrowthRate: number;
	growthFrequency: Frequency;
}

export interface AssetSelection {
	enabled: boolean;
	amountOverride?: number;
	isInvestment: boolean;
	investmentConfig: InvestmentConfig;
}

export interface ExpenseSelection {
	enabled: boolean;
	amountOverride?: number;
	hasGrowth: boolean;
	growthConfig: GrowthConfig;
}

export interface HomeSelection {
	/** Whether this home is sold as part of the move. */
	enabled: boolean;
}

export interface AdHocExpense {
	id: string;
	name: string;
	amount: number;
	hasGrowth: boolean;
	growthConfig: GrowthConfig;
}

export type OverridableField =
	| 'housePrice'
	| 'interestRate'
	| 'loanYears'
	| 'propertyTaxRate'
	| 'monthlyInsurance';

export interface FutureOverride {
	futureValue: number | null;
	isOverridden: boolean;
}

export interface FutureMode {
	enabled: boolean;
	moveDate: string;
	homePriceInflationRate: number;
	currentHomeGrowthRate: number;
}

export interface CostToMoveState {
	id: 'singleton';
	housePrice: number;
	interestRate: number;
	loanYears: number;
	propertyTaxRate: number;
	monthlyInsurance: number;

	assetSelections: Record<string, AssetSelection>;
	expenseSelections: Record<string, ExpenseSelection>;
	homeSelections: Record<string, HomeSelection>;

	adHocExpenses: AdHocExpense[];
	/** Ad-hoc deductions applied to total net proceeds across all sold homes. */
	currentHomeExpenses: AdHocExpense[];

	futureMode: FutureMode;
	futureOverrides: Record<OverridableField, FutureOverride>;
}

export interface ExportEnvelope {
	version: 1;
	exportedAt: string;
	items: Item[];
	homes: Home[];
	journalEntries: JournalEntry[];
	costToMove: CostToMoveState | null;
}
