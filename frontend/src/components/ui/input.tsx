import type * as React from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
	return (
		<input
			type={type}
			data-slot="input"
			className={cn(
				"themed-input-surface file:text-foreground placeholder:text-(--text-2) selection:bg-ring selection:text-primary-foreground h-10 w-full min-w-0 rounded-[var(--button-radius)] px-3 py-1 text-base shadow-xs transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
				"hover:border-(--button-hot-border) focus-visible:border-ring focus-visible:ring-[color-mix(in_oklab,var(--accent-blue)_40%,transparent)] focus-visible:ring-[3px]",
				"aria-invalid:ring-[color-mix(in_oklab,var(--danger-0)_30%,transparent)] aria-invalid:border-destructive-foreground",
				className,
			)}
			{...props}
		/>
	);
}

export { Input };
