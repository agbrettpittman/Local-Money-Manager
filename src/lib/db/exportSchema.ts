import { z } from 'zod';
import { ENVELOPE_VERSION } from './snapshot';

const frequencySchema = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

const itemSchema = z.object({
	id: z.string(),
	name: z.string(),
	kind: z.enum(['asset', 'liability']),
	parentId: z.string().optional(),
	homeId: z.string().optional(),
	archivedAt: z.string().optional(),
	createdAt: z.string()
});

const homeSchema = z.object({
	id: z.string(),
	name: z.string(),
	valueItemId: z.string(),
	mortgageItemId: z.string(),
	sellingCostPercent: z.number(),
	mortgageRate: z.number(),
	mortgageYears: z.number(),
	mortgageStartDate: z.string().optional(),
	archivedAt: z.string().optional(),
	createdAt: z.string()
});

const journalLineSchema = z.object({
	itemId: z.string(),
	amount: z.number()
});

const journalEntrySchema = z.object({
	id: z.string(),
	date: z.string(),
	lines: z.array(journalLineSchema),
	notes: z.string().optional(),
	createdAt: z.string(),
	updatedAt: z.string()
});

const investmentConfigSchema = z.object({
	annualReturnRate: z.number(),
	contributionAmount: z.number(),
	contributionFrequency: frequencySchema
});

const growthConfigSchema = z.object({
	annualGrowthRate: z.number(),
	growthFrequency: frequencySchema
});

const assetSelectionSchema = z.object({
	enabled: z.boolean(),
	amountOverride: z.number().optional(),
	isInvestment: z.boolean(),
	investmentConfig: investmentConfigSchema
});

const expenseSelectionSchema = z.object({
	enabled: z.boolean(),
	amountOverride: z.number().optional(),
	hasGrowth: z.boolean(),
	growthConfig: growthConfigSchema
});

const homeSelectionSchema = z.object({
	enabled: z.boolean()
});

const adHocExpenseSchema = z.object({
	id: z.string(),
	name: z.string(),
	amount: z.number(),
	hasGrowth: z.boolean(),
	growthConfig: growthConfigSchema
});

const overrideSchema = z.object({
	futureValue: z.number().nullable(),
	isOverridden: z.boolean()
});

const overridableField = z.enum([
	'housePrice',
	'interestRate',
	'loanYears',
	'propertyTaxRate',
	'monthlyInsurance'
]);

const costToMoveSchema = z.object({
	id: z.literal('singleton'),
	housePrice: z.number(),
	interestRate: z.number(),
	loanYears: z.number(),
	propertyTaxRate: z.number(),
	monthlyInsurance: z.number(),
	assetSelections: z.record(z.string(), assetSelectionSchema),
	expenseSelections: z.record(z.string(), expenseSelectionSchema),
	homeSelections: z.record(z.string(), homeSelectionSchema),
	adHocExpenses: z.array(adHocExpenseSchema),
	currentHomeExpenses: z.array(adHocExpenseSchema),
	futureMode: z.object({
		enabled: z.boolean(),
		moveDate: z.string(),
		homePriceInflationRate: z.number(),
		currentHomeGrowthRate: z.number()
	}),
	futureOverrides: z.record(overridableField, overrideSchema)
});

// Validates the *current* format only — anything older is brought up to it by
// migrateEnvelope first, so this never has to describe historical shapes.
export const exportEnvelopeSchema = z.object({
	version: z.literal(ENVELOPE_VERSION),
	exportedAt: z.string(),
	items: z.array(itemSchema),
	homes: z.array(homeSchema).default([]),
	journalEntries: z.array(journalEntrySchema),
	costToMove: costToMoveSchema.nullable()
});

export type ParsedEnvelope = z.infer<typeof exportEnvelopeSchema>;
