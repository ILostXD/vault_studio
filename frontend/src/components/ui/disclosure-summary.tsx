import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export function DisclosureSummary({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<summary
			className={`flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl p-2.5 text-sm font-medium transition-colors hover:bg-(--action-bg-hover) sm:p-3 [&::-webkit-details-marker]:hidden [[open]>&>svg]:rotate-180 ${className}`}
		>
			{children}
			<ChevronDown className="size-4 shrink-0 text-(--text-2) transition-transform duration-200" />
		</summary>
	);
}
