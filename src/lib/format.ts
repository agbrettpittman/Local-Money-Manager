const currencyFormatter = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 0,
	maximumFractionDigits: 2
});

const currencyFormatterPrecise = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 2
});

const numberFormatter = new Intl.NumberFormat('en-US');

export function formatCurrency(value: number, precise = false): string {
	return (precise ? currencyFormatterPrecise : currencyFormatter).format(value);
}

export function formatWithCommas(value: number): string {
	if (value === 0 || Number.isNaN(value)) return '';
	return numberFormatter.format(value);
}

export function parseNumberInput(raw: string): number {
	if (!raw) return 0;
	const n = parseFloat(raw.replace(/,/g, ''));
	return Number.isNaN(n) ? 0 : n;
}
