import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const weekdays = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

export function DatePicker({
	value = "",
	onValueChange,
	placeholder = "dd/mm/yyyy",
	disabled = false,
	id,
	className,
}: {
	value?: string;
	onValueChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	id?: string;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const selected = parseDate(value);
	const [month, setMonth] = useState(() =>
		startOfMonth(selected ?? new Date()),
	);

	useEffect(() => {
		if (open) setMonth(startOfMonth(selected ?? new Date()));
	}, [open, selected]);

	const days = useMemo(() => calendarDays(month), [month]);
	const today = formatDate(new Date());

	return (
		<PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
			<PopoverPrimitive.Trigger asChild>
				<button
					id={id}
					type="button"
					disabled={disabled}
					className={cn(
						"group themed-input-surface flex h-10 w-full items-center justify-between rounded-[var(--button-radius)] px-3 text-left text-sm outline-none transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-(--button-hot-border) focus-visible:border-(--accent-blue) focus-visible:ring-2 focus-visible:ring-(--accent-blue)/25 disabled:cursor-not-allowed disabled:opacity-50",
						!selected && "text-(--text-2)",
						className,
					)}
				>
					<span>{selected ? displayDate(selected) : placeholder}</span>
					<CalendarDays
						aria-hidden
						className="size-4 text-(--text-2) transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] group-data-[state=open]:scale-90"
					/>
				</button>
			</PopoverPrimitive.Trigger>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Content
					align="start"
					sideOffset={8}
					onOpenAutoFocus={(event) => event.preventDefault()}
					className="z-1100 w-[19rem] rounded-[var(--button-radius)] border border-(--card-border) bg-(--bg-1)/96 p-3 text-(--text-0) shadow-2xl backdrop-blur-xl data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
				>
					<div className="flex h-9 items-center justify-between">
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Previous month"
							onClick={() => setMonth(addMonths(month, -1))}
						>
							<ChevronLeft />
						</Button>
						<p className="text-sm font-semibold">
							{month.toLocaleDateString(undefined, {
								month: "long",
								year: "numeric",
							})}
						</p>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Next month"
							onClick={() => setMonth(addMonths(month, 1))}
						>
							<ChevronRight />
						</Button>
					</div>
					<div className="mt-2 grid grid-cols-7 gap-1" aria-hidden>
						{weekdays.map((day) => (
							<span
								key={day}
								className="flex h-7 items-center justify-center text-xs text-(--text-2)"
							>
								{day}
							</span>
						))}
					</div>
					<div className="overflow-hidden">
						<AnimatePresence initial={false} mode="popLayout">
							<motion.div
								key={`${month.getFullYear()}-${month.getMonth()}`}
								initial={{ opacity: 0, x: 8 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -8 }}
								transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
								className="grid grid-cols-7 gap-1"
							>
								{days.map((day) => {
									const dayValue = formatDate(day);
									const isSelected = dayValue === value;
									const isCurrentMonth = day.getMonth() === month.getMonth();
									return (
										<button
											key={dayValue}
											type="button"
											aria-label={day.toLocaleDateString()}
											aria-pressed={isSelected}
											onClick={() => {
												onValueChange(dayValue);
												setOpen(false);
											}}
											className={cn(
												"flex aspect-square items-center justify-center rounded-[9px] text-sm outline-none transition-[transform,background-color,color,border-color] duration-150 hover:bg-(--action-bg-hover) active:scale-90 focus-visible:ring-2 focus-visible:ring-(--accent-blue)",
												!isCurrentMonth && "text-(--text-2)",
												dayValue === today &&
													!isSelected &&
													"border border-(--card-border)",
												isSelected &&
													"bg-(--accent-blue) font-semibold text-(--bg-0) hover:bg-(--accent-blue)",
											)}
										>
											{day.getDate()}
										</button>
									);
								})}
							</motion.div>
						</AnimatePresence>
					</div>
					<div className="mt-3 flex items-center justify-between border-t border-(--card-border) pt-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								onValueChange("");
								setOpen(false);
							}}
						>
							Clear
						</Button>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => {
								onValueChange(today);
								setOpen(false);
							}}
						>
							Today
						</Button>
					</div>
				</PopoverPrimitive.Content>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

function parseDate(value: string) {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return null;
	const date = new Date(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
	);
	return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function displayDate(date: Date) {
	return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
}

function startOfMonth(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
	return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function calendarDays(month: Date) {
	const firstWeekday = (month.getDay() + 6) % 7;
	const first = new Date(
		month.getFullYear(),
		month.getMonth(),
		1 - firstWeekday,
	);
	return Array.from(
		{ length: 42 },
		(_, index) =>
			new Date(first.getFullYear(), first.getMonth(), first.getDate() + index),
	);
}
