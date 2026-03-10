import { forwardRef, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

type Variant = "default" | "outline" | "ghost" | "destructive" | "secondary";
type Size = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  default: "bg-slate-900 text-white hover:bg-slate-800 border border-transparent",
  outline: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100 border border-transparent",
  destructive: "bg-red-600 text-white hover:bg-red-700 border border-transparent",
  secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 border border-transparent",
};

const sizes: Record<Size, string> = {
  default: "h-9 px-4 py-2 text-sm",
  sm: "h-8 px-3 py-1.5 text-xs",
  lg: "h-11 px-6 py-2.5 text-base",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={clsx(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
          "disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
