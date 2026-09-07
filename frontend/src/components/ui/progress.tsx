import { cn } from "@/lib/utils";

export function Progress({
	value,
	className,
}: {
	value?: number;
	className?: string;
}) {
	const percentage =
		value == null ? undefined : Math.max(0, Math.min(100, value));
	return (
		<div
			role="progressbar"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percentage == null ? undefined : Math.round(percentage)}
			className={cn(
				"h-1.5 w-full overflow-hidden rounded-full bg-(--action-bg-active)",
				className,
			)}
		>
			<div
				className={`h-full rounded-full bg-(--accent-blue) transition-[width] duration-200 ${percentage == null ? "w-1/3 animate-pulse" : ""}`}
				style={percentage == null ? undefined : { width: `${percentage}%` }}
			/>
		</div>
	);
}
