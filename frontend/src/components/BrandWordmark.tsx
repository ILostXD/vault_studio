import { cn } from "@/lib/utils";

interface BrandWordmarkProps {
  className?: string;
}

export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span className={cn("whitespace-nowrap", className)} aria-label="vault studio">
      {"{ vault"}
      <span className="text-(--text-2)">.studio</span>
      {" }"}
    </span>
  );
}
