import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'success';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variants = {
      default: "border border-transparent bg-[var(--fibro-purple)] text-white shadow-[0_8px_18px_rgba(123,44,191,0.14)] hover:bg-[var(--fibro-purple-strong)]",
      destructive: "border border-transparent bg-red-600 text-white shadow-[0_8px_18px_rgba(220,38,38,0.12)] hover:bg-red-700",
      outline: "border border-[var(--border-soft)] bg-white text-[var(--brand-ink)] hover:border-[var(--fibro-purple-border)] hover:bg-[var(--fibro-purple-soft)] hover:text-[var(--fibro-purple)]",
      secondary: "border border-[var(--fibro-purple-border)] bg-[var(--fibro-purple-soft)] text-[var(--fibro-purple)] hover:bg-[#eadcff]",
      ghost: "border border-transparent bg-transparent text-[var(--brand-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--brand-ink)]",
      link: "text-[var(--fibro-purple)] underline-offset-4 hover:underline",
      success: "border border-transparent bg-[#168821] text-white shadow-[0_8px_18px_rgba(22,136,33,0.12)] hover:bg-[#126b1c]",
    }
    const sizes = {
      default: "h-11 px-4 py-2",
      sm: "h-9 px-3",
      lg: "h-12 px-8",
      icon: "h-11 w-11",
    }
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex min-w-0 items-center justify-center rounded-xl text-sm font-semibold ring-offset-white transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fibro-purple)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
