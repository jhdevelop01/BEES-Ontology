import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/* 버튼 컴포넌트 — 디지털 트윈 다크 테마 */

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:shadow-glow",
        destructive: "bg-gradient-to-r from-rose-500 to-red-600 text-white hover:shadow-glow-rose",
        outline:
          "border border-white/20 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white",
        secondary: "bg-white/10 text-slate-200 hover:bg-white/15",
        ghost: "text-slate-300 hover:bg-white/5 hover:text-white",
        link: "text-cyan-400 underline-offset-4 hover:underline",
        success: "bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:shadow-glow-emerald",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
