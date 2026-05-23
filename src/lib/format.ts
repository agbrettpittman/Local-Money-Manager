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

export function formatDuration(months: number): string {
	const yrs = Math.floor(months / 12);
	const mos = months % 12;
	const parts: string[] = [];
	if (yrs > 0) parts.push(`${yrs}y`);
	if (mos > 0 || yrs === 0) parts.push(`${mos}m`);
	return parts.join(' ');
}

export function parseNumberInput(raw: string): number {
	if (!raw) return 0;
	const n = parseFloat(raw.replace(/,/g, ''));
	return Number.isNaN(n) ? 0 : n;
}
