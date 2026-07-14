import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "mint" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand-blue)] text-white shadow-sm hover:bg-[var(--brand-blue-dark)] active:bg-[var(--brand-blue-dark)]",
  secondary:
    "border border-[var(--brand-blue)] bg-white text-[var(--brand-blue-dark)] hover:bg-blue-50 active:bg-blue-100",
  mint: "bg-[var(--brand-mint)] text-[var(--brand-mint-ink)] hover:bg-emerald-300 active:bg-emerald-400",
  ghost: "text-[var(--brand-navy)] hover:bg-slate-100 active:bg-slate-200",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900",
};

const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
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
    "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
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
