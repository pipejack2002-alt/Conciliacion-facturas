import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent text-accent-fg",
        rule: "border-transparent bg-rule text-accent-fg",
        outline: "border-border text-muted",
        paper: "border-border bg-paper text-ink",
        ok: "border-transparent bg-ok-soft text-ok",
        bad: "border-transparent bg-bad-soft text-bad",
        warn: "border-transparent bg-warn-soft text-warn",
      },
    },
    defaultVariants: {
      variant: "outline",
    },
  },
);

export function Badge({
  className,
  variant,
  ...props
}: HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
