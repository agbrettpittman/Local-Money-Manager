import { v4 as uuid } from 'uuid';
import { db } from '$lib/db/schema';
import type { Home, Item, JournalEntry } from '$lib/db/types';
import {
	defaultAssetSelection,
	defaultCostToMoveState,
	defaultHomeSelection
} from '$lib/cost-to-move/defaults';

function isoDate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export async function loadDemoData(): Promise<void> {
	await db.transaction('rw', [db.items, db.homes, db.journalEntries, db.costToMove], async () => {
		await db.items.clear();
		await db.homes.clear();
		await db.journalEntries.clear();
		await db.costToMove.clear();

		const now = new Date().toISOString();

		// Top-level "Bank" parent with two sub-assets.
		const bank: Item = { id: uuid(), name: 'Bank', kind: 'asset', createdAt: now };
		const checking: Item = {
			id: uuid(),
			name: 'Checking',
			kind: 'asset',
			parentId: bank.id,
			createdAt: now
		};
		const savings: Item = {
			id: uuid(),
			name: 'Savings',
			kind: 'asset',
			parentId: bank.id,
			createdAt: now
		};

		// Top-level brokerage and retirement.
		const brokerage: Item = { id: uuid(), name: 'Brokerage', kind: 'asset', createdAt: now };
		const retirement: Item = { id: uuid(), name: 'Retirement', kind: 'asset', createdAt: now };

		// Liabilities.
		const card: Item = { id: uuid(), name: 'Credit Card', kind: 'liability', createdAt: now };
		const car: Item = { id: uuid(), name: 'Car Loan', kind: 'liability', createdAt: now };

		// Home: Primary Residence (auto-creates value asset + mortgage liability).
		const homeId = uuid();
		const homeValue: Item = {
			id: uuid(),
			name: 'Primary Residence',
			kind: 'asset',
			homeId,
			createdAt: now
		};
		const homeMortgage: Item = {
			id: uuid(),
			name: 'Primary Residence Mortgage',
			kind: 'liability',
			homeId,
			createdAt: now
		};
		const fiveYearsAgo = (() => {
			const t = new Date();
			const d = new Date(t.getFullYear() - 5, t.getMonth(), 1);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		})();
		const home: Home = {
			id: homeId,
			name: 'Primary Residence',
			valueItemId: homeValue.id,
			mortgageItemId: homeMortgage.id,
			sellingCostPercent: 7,
			mortgageRate: 4,
			mortgageYears: 30,
			mortgageStartDate: fiveYearsAgo,
			createdAt: now
		};

		await db.items.bulkAdd([
			bank,
			checking,
			savings,
			brokerage,
			retirement,
			card,
			car,
			homeValue,
			homeMortgage
		]);
		await db.homes.add(home);

		const today = new Date();
		const entries: JournalEntry[] = [];
		for (let i = 11; i >= 0; i--) {
			const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
			const monthsAgo = i;
			// Sub-assets only — "Bank" itself isn't logged; it's a grouping label.
			const checkingAmt = 3000 + (11 - monthsAgo) * 100 + Math.round(Math.random() * 200);
			const savingsAmt = 8000 + (11 - monthsAgo) * 250 + Math.round(Math.random() * 400);
			const brokerageAmt = 25000 + (11 - monthsAgo) * 800 + Math.round(Math.random() * 1500);
			const retirementAmt = 80000 + (11 - monthsAgo) * 1500 + Math.round(Math.random() * 1000);
			const cardAmt = Math.max(0, 2500 - (11 - monthsAgo) * 50 + Math.round(Math.random() * 800));
			const carAmt = Math.max(0, 18000 - (11 - monthsAgo) * 300);
			// Home value drifts up; mortgage balance drifts down.
			const homeValueAmt = 350_000 + (11 - monthsAgo) * 1000;
			const homeMortgageAmt = Math.max(0, 200_000 - (11 - monthsAgo) * 600);

			entries.push({
				id: uuid(),
				date: isoDate(d),
				lines: [
					{ itemId: checking.id, amount: checkingAmt },
					{ itemId: savings.id, amount: savingsAmt },
					{ itemId: brokerage.id, amount: brokerageAmt },
					{ itemId: retirement.id, amount: retirementAmt },
					{ itemId: card.id, amount: cardAmt },
					{ itemId: car.id, amount: carAmt },
					{ itemId: homeValue.id, amount: homeValueAmt },
					{ itemId: homeMortgage.id, amount: homeMortgageAmt }
				],
				createdAt: d.toISOString(),
				updatedAt: d.toISOString()
			});
		}
		await db.journalEntries.bulkAdd(entries);

		const ctm = defaultCostToMoveState();
		ctm.housePrice = 500_000;
		ctm.interestRate = 6.5;
		ctm.loanYears = 30;
		ctm.propertyTaxRate = 1.2;
		ctm.monthlyInsurance = 150;
		ctm.assetSelections = {
			[checking.id]: defaultAssetSelection(),
			[savings.id]: defaultAssetSelection(),
			[brokerage.id]: { ...defaultAssetSelection(), isInvestment: false }
		};
		ctm.homeSelections = {
			[home.id]: defaultHomeSelection()
		};
		ctm.adHocExpenses = [
			{
				id: uuid(),
				name: 'Moving costs',
				amount: 5000,
				hasGrowth: false,
				growthConfig: { annualGrowthRate: 0, growthFrequency: 'yearly' }
			}
		];
		await db.costToMove.put(ctm);
	});
}
