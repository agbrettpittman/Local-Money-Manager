<script lang="ts">
	import { page } from '$app/state';

	interface Props {
		href: string;
		exact?: boolean;
		children?: import('svelte').Snippet;
	}

	let { href, exact = false, children }: Props = $props();

	const active = $derived(exact ? page.url.pathname === href : page.url.pathname.startsWith(href));
</script>

<a {href} class:menu-active={active} aria-current={active ? 'page' : undefined}>
	{@render children?.()}
</a>
