import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "mint" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand-blue)] text-white shadow-[0_1px_2px_rgba(29,86,232,0.22)] hover:bg-[var(--brand-blue-dark)] active:bg-[var(--brand-blue-dark)]",
  secondary:
    "border border-slate-200 bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100",
  mint: "bg-emerald-600 text-white shadow-[0_1px_2px_rgba(5,150,105,0.22)] hover:bg-emerald-700 active:bg-emerald-800",
  ghost: "text-slate-700 hover:bg-slate-100 hover:text-[var(--brand-navy)] active:bg-slate-200/70",
  danger: "bg-red-600 text-white shadow-[0_1px_2px_rgba(220,38,38,0.2)] hover:bg-red-700 active:bg-red-800",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3.5 text-xs",
  md: "min-h-10 px-4 text-sm",
  lg: "min-h-11 px-5 text-sm",
};

export function buttonStyles({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonStyles({ variant, size, className })} {...props} />;
}
