<script lang="ts">
	import { formatWithCommas, parseNumberInput } from '$lib/format';

	interface Props {
		value: number;
		onChange?: (value: number) => void;
		onCommit?: (value: number) => void;
		placeholder?: string;
		disabled?: boolean;
		ariaLabel?: string;
		size?: 'sm' | 'md';
		/** Extra class(es) for the input text colour (e.g. text-success / text-error). */
		toneClass?: string;
	}

	let {
		value,
		onChange,
		onCommit,
		placeholder = '0',
		disabled = false,
		ariaLabel,
		size = 'sm',
		toneClass = ''
	}: Props = $props();

	let display = $state('');
	let focused = $state(false);

	$effect(() => {
		if (!focused) {
			display = value === 0 ? '' : formatWithCommas(value);
		}
	});

	function handleFocus(e: FocusEvent) {
		focused = true;
		const raw = parseNumberInput((e.target as HTMLInputElement).value);
		display = raw === 0 ? '' : String(raw);
	}

	function handleBlur() {
		focused = false;
		const n = parseNumberInput(display);
		display = n === 0 ? '' : formatWithCommas(n);
		onCommit?.(n);
	}

	function handleInput(e: Event) {
		display = (e.target as HTMLInputElement).value;
		onChange?.(parseNumberInput(display));
	}
</script>

<input
	type="text"
	inputmode="numeric"
	{placeholder}
	{disabled}
	aria-label={ariaLabel}
	value={display}
	oninput={handleInput}
	onfocus={handleFocus}
	onblur={handleBlur}
	class="num input w-full text-right {size === 'sm' ? 'input-sm' : ''} {toneClass}"
/>
