import { HTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "default" | "outline" | "secondary" | "destructive";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const variants: Record<Variant, string> = {
  default: "bg-slate-900 text-white border-transparent",
  outline: "border border-slate-300 text-slate-700 bg-transparent",
  secondary: "bg-slate-100 text-slate-700 border-transparent",
  destructive: "bg-red-100 text-red-700 border-transparent",
};

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
