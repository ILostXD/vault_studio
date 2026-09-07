import { Plus, Trash2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useId, useRef } from "react";
import type { Credit } from "@/api/distribution";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export const fieldClass =
	"themed-input-surface h-10 w-full min-w-0 rounded-[var(--button-radius)] px-3 text-base outline-none transition-[border-color,box-shadow] focus-visible:border-(--accent-blue) focus-visible:ring-2 focus-visible:ring-(--accent-blue)/25 md:text-sm";

const creditRoles = [
	"Composer",
	"Lyricist",
	"Producer",
	"Performer",
	"Mixing Engineer",
	"Mastering Engineer",
];

export function CreditsEditor({
	value,
	onChange,
}: {
	value: Credit[];
	onChange: (value: Credit[]) => void;
}) {
	const id = useId();
	const nextKey = useRef(0);
	const rowKeys = useRef<string[]>([]);
	while (rowKeys.current.length < value.length) {
		rowKeys.current.push(`${id}-credit-${nextKey.current++}`);
	}
	rowKeys.current.length = value.length;
	const rows = value.map((credit, index) => ({
		credit,
		index,
		key: rowKeys.current[index],
	}));
	return (
		<div className="space-y-2">
			<AnimatePresence initial={false} mode="popLayout">
				{rows.map(({ credit, index, key }) => (
					<motion.div
						key={key}
						layout="position"
						initial={{ opacity: 0, y: -6, scale: 0.985 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: -6, scale: 0.985 }}
						transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
						className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2"
					>
						<label
							htmlFor={`${id}-name-${index}`}
							className="min-w-0 space-y-1 text-xs text-(--text-1)"
						>
							<span>Name {index + 1}</span>
							<Input
								id={`${id}-name-${index}`}
								value={credit.name}
								onChange={(e) =>
									onChange(
										value.map((item, i) =>
											i === index ? { ...item, name: e.target.value } : item,
										),
									)
								}
							/>
						</label>
						<label
							htmlFor={`${id}-role-${index}`}
							className="min-w-0 space-y-1 text-xs text-(--text-1)"
						>
							<span>Role {index + 1}</span>
							<Select
								value={credit.role || "__unset_role__"}
								onValueChange={(role) =>
									onChange(
										value.map((item, i) =>
											i === index
												? {
														...item,
														role: role === "__unset_role__" ? "" : role,
													}
												: item,
										),
									)
								}
							>
								<SelectTrigger id={`${id}-role-${index}`}>
									<SelectValue placeholder="Choose role" />
								</SelectTrigger>
								<SelectContent>
									{!credit.role && (
										<SelectItem value="__unset_role__">Choose role</SelectItem>
									)}
									{credit.role && !creditRoles.includes(credit.role) && (
										<SelectItem value={credit.role}>{credit.role}</SelectItem>
									)}
									{creditRoles.map((role) => (
										<SelectItem key={role} value={role}>
											{role}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</label>
						<Button
							type="button"
							size="icon"
							variant="ghost"
							className="self-end text-(--danger-0) transition-colors hover:bg-(--danger-1) hover:text-(--danger-0)"
							title={`Remove credit ${index + 1}`}
							aria-label={`Remove credit ${index + 1}`}
							onClick={() => {
								rowKeys.current.splice(index, 1);
								onChange(value.filter((_, i) => i !== index));
							}}
						>
							<Trash2 />
						</Button>
					</motion.div>
				))}
			</AnimatePresence>
			<div className="flex min-h-14 items-center">
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => {
						rowKeys.current.push(`${id}-credit-${nextKey.current++}`);
						onChange([...value, { name: "", role: "" }]);
					}}
				>
					<Plus />
					Add credit
				</Button>
			</div>
		</div>
	);
}
