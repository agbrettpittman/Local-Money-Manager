import Dexie, { type Table } from 'dexie';
import type { CostToMoveState, Home, Item, JournalEntry } from './types';

export class AppDatabase extends Dexie {
	items!: Table<Item, string>;
	homes!: Table<Home, string>;
	journalEntries!: Table<JournalEntry, string>;
	costToMove!: Table<CostToMoveState, 'singleton'>;

	constructor() {
		super('LocalMoneyManagerDB');
		this.version(1).stores({
			items: 'id, kind, archivedAt',
			journalEntries: 'id, &date',
			costToMove: 'id'
		});
		this.version(2)
			.stores({
				items: 'id, kind, archivedAt, homeId',
				journalEntries: 'id, &date',
				costToMove: 'id',
				homes: 'id, archivedAt'
			})
			.upgrade(async (tx) => {
				const ctm = await tx.table('costToMove').get('singleton');
				if (ctm) {
					delete ctm.currentHomeValue;
					delete ctm.remainingMortgage;
					delete ctm.sellingCostPercent;
					delete ctm.currentMortgageRate;
					delete ctm.currentMortgageYears;
					if (ctm.futureOverrides) {
						delete ctm.futureOverrides.currentHomeValue;
						delete ctm.futureOverrides.remainingMortgage;
						delete ctm.futureOverrides.sellingCostPercent;
					}
					ctm.homeSelections = {};
					await tx.table('costToMove').put(ctm);
				}
			});
	}
}

export const db = new AppDatabase();
