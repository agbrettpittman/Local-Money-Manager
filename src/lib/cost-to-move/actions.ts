import { v4 as uuid } from 'uuid';
import { getCostToMove, saveCostToMove } from '$lib/db/repo';
import type {
	AdHocExpense,
	AssetSelection,
	CostToMoveState,
	ExpenseSelection,
	Frequency,
	OverridableField
} from '$lib/db/types';
import { defaultAssetSelection, defaultExpenseSelection, defaultHomeSelection } from './defaults';

let queue: Promise<unknown> = Promise.resolve();

export function update(patch: (current: CostToMoveState) => CostToMoveState): Promise<void> {
	const next = queue.then(async () => {
		const current = await getCostToMove();
		const updated = patch(current);
		await saveCostToMove(updated);
	});
	queue = next.catch(() => {
		// swallow so future updates still run
	});
	return next;
}

// ── New home / current home fields ─────────────────────────

export function setField<K extends keyof CostToMoveState>(
	key: K,
	value: CostToMoveState[K]
): Promise<void> {
	return update((s) => ({ ...s, [key]: value }));
}

// ── Home selections ───────────────────────────────────────

export function toggleHomeSelection(homeId: string): Promise<void> {
	return update((s) => {
		const existing = s.homeSelections[homeId] ?? defaultHomeSelection();
		return {
			...s,
			homeSelections: {
				...s.homeSelections,
				[homeId]: { ...existing, enabled: !existing.enabled }
			}
		};
	});
}

export function setHomeSelection(homeId: string, enabled: boolean): Promise<void> {
	return update((s) => {
		const existing = s.homeSelections[homeId] ?? defaultHomeSelection();
		return {
			...s,
			homeSelections: {
				...s.homeSelections,
				[homeId]: { ...existing, enabled }
			}
		};
	});
}

// ── Asset selections ──────────────────────────────────────

export function toggleAsset(itemId: string): Promise<void> {
	return update((s) => {
		const existing = s.assetSelections[itemId] ?? defaultAssetSelection();
		return {
			...s,
			assetSelections: {
				...s.assetSelections,
				[itemId]: { ...existing, enabled: !existing.enabled }
			}
		};
	});
}

export function setAssetAmountOverride(itemId: string, amount: number | undefined): Promise<void> {
	return update((s) => {
		const existing = s.assetSelections[itemId] ?? defaultAssetSelection();
		const next: AssetSelection = { ...existing };
		if (amount === undefined) delete next.amountOverride;
		else next.amountOverride = amount;
		return {
			...s,
			assetSelections: { ...s.assetSelections, [itemId]: next }
		};
	});
}

export function toggleAssetInvestment(itemId: string): Promise<void> {
	return update((s) => {
		const existing = s.assetSelections[itemId] ?? defaultAssetSelection();
		return {
			...s,
			assetSelections: {
				...s.assetSelections,
				[itemId]: { ...existing, isInvestment: !existing.isInvestment }
			}
		};
	});
}

export function setAssetInvestmentField<K extends keyof AssetSelection['investmentConfig']>(
	itemId: string,
	field: K,
	value: AssetSelection['investmentConfig'][K]
): Promise<void> {
	return update((s) => {
		const existing = s.assetSelections[itemId] ?? defaultAssetSelection();
		return {
			...s,
			assetSelections: {
				...s.assetSelections,
				[itemId]: {
					...existing,
					investmentConfig: { ...existing.investmentConfig, [field]: value }
				}
			}
		};
	});
}

// ── Expense selections ────────────────────────────────────

export function toggleExpense(itemId: string): Promise<void> {
	return update((s) => {
		const existing = s.expenseSelections[itemId] ?? defaultExpenseSelection();
		return {
			...s,
			expenseSelections: {
				...s.expenseSelections,
				[itemId]: { ...existing, enabled: !existing.enabled }
			}
		};
	});
}

export function setExpenseAmountOverride(
	itemId: string,
	amount: number | undefined
): Promise<void> {
	return update((s) => {
		const existing = s.expenseSelections[itemId] ?? defaultExpenseSelection();
		const next: ExpenseSelection = { ...existing };
		if (amount === undefined) delete next.amountOverride;
		else next.amountOverride = amount;
		return {
			...s,
			expenseSelections: { ...s.expenseSelections, [itemId]: next }
		};
	});
}

export function toggleExpenseGrowth(itemId: string): Promise<void> {
	return update((s) => {
		const existing = s.expenseSelections[itemId] ?? defaultExpenseSelection();
		return {
			...s,
			expenseSelections: {
				...s.expenseSelections,
				[itemId]: { ...existing, hasGrowth: !existing.hasGrowth }
			}
		};
	});
}

export function setExpenseGrowthField<K extends keyof ExpenseSelection['growthConfig']>(
	itemId: string,
	field: K,
	value: ExpenseSelection['growthConfig'][K]
): Promise<void> {
	return update((s) => {
		const existing = s.expenseSelections[itemId] ?? defaultExpenseSelection();
		return {
			...s,
			expenseSelections: {
				...s.expenseSelections,
				[itemId]: {
					...existing,
					growthConfig: { ...existing.growthConfig, [field]: value }
				}
			}
		};
	});
}

// ── Ad-hoc expenses ───────────────────────────────────────

type AdHocBucket = 'adHocExpenses' | 'currentHomeExpenses';

export function addAdHoc(bucket: AdHocBucket): Promise<void> {
	const next: AdHocExpense = {
		id: uuid(),
		name: '',
		amount: 0,
		hasGrowth: false,
		growthConfig: { annualGrowthRate: 2, growthFrequency: 'yearly' }
	};
	return update((s) => ({ ...s, [bucket]: [...s[bucket], next] }));
}

export function updateAdHoc(
	bucket: AdHocBucket,
	id: string,
	patch: Partial<AdHocExpense>
): Promise<void> {
	return update((s) => ({
		...s,
		[bucket]: s[bucket].map((e) => (e.id === id ? { ...e, ...patch } : e))
	}));
}

export function removeAdHoc(bucket: AdHocBucket, id: string): Promise<void> {
	return update((s) => ({
		...s,
		[bucket]: s[bucket].filter((e) => e.id !== id)
	}));
}

export function toggleAdHocGrowth(bucket: AdHocBucket, id: string): Promise<void> {
	return update((s) => ({
		...s,
		[bucket]: s[bucket].map((e) => (e.id === id ? { ...e, hasGrowth: !e.hasGrowth } : e))
	}));
}

export function setAdHocGrowthField(
	bucket: AdHocBucket,
	id: string,
	field: keyof AdHocExpense['growthConfig'],
	value: AdHocExpense['growthConfig'][typeof field]
): Promise<void> {
	return update((s) => ({
		...s,
		[bucket]: s[bucket].map((e) =>
			e.id === id ? { ...e, growthConfig: { ...e.growthConfig, [field]: value } } : e
		)
	}));
}

// ── Future mode ──────────────────────────────────────────

export function setFutureField<K extends keyof CostToMoveState['futureMode']>(
	field: K,
	value: CostToMoveState['futureMode'][K]
): Promise<void> {
	return update((s) => ({
		...s,
		futureMode: { ...s.futureMode, [field]: value }
	}));
}

export function toggleOverride(field: OverridableField): Promise<void> {
	return update((s) => {
		const existing = s.futureOverrides[field];
		const isOverridden = !existing.isOverridden;
		return {
			...s,
			futureOverrides: {
				...s.futureOverrides,
				[field]: {
					isOverridden,
					futureValue: isOverridden ? (existing.futureValue ?? (s[field] as number)) : null
				}
			}
		};
	});
}

export function setOverrideValue(field: OverridableField, value: number): Promise<void> {
	return update((s) => ({
		...s,
		futureOverrides: {
			...s.futureOverrides,
			[field]: { ...s.futureOverrides[field], futureValue: value }
		}
	}));
}

export type { Frequency };
