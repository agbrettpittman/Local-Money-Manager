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

/**
 * Compact axis tick label. Abbreviates only when the gap between ticks survives
 * it — a $1k–$2k axis stepping by $100 would otherwise render every tick as
 * "$1k" or "$2k". `step` is the spacing between adjacent ticks.
 */
export function formatAxisTick(value: number, step = 0): string {
	const abs = Math.abs(value);
	const gap = Math.abs(step);
	if (abs >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(gap >= 1_000_000 ? 0 : 1)}M`;
	}
	if (abs >= 10_000) {
		return `$${(value / 1_000).toFixed(gap >= 1_000 ? 0 : 1)}k`;
	}
	return formatCurrency(Math.round(value));
}
