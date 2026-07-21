import { type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = BaseTooltip.Provider;
export const TooltipRoot = BaseTooltip.Root;
export const TooltipTrigger = BaseTooltip.Trigger;
export const TooltipPortal = BaseTooltip.Portal;
export const TooltipPositioner = BaseTooltip.Positioner;

export function TooltipPopup({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof BaseTooltip.Popup>) {
  return (
    <BaseTooltip.Popup
      className={cn(
        "rounded bg-card px-2 py-1 text-xs text-card-foreground shadow-md border border-border",
        className,
      )}
      {...props}
    />
  );
}

interface TooltipProps {
  label: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ label, children, side = "right", className }: TooltipProps) {
  return (
    <TooltipProvider>
      <TooltipRoot>
        <TooltipTrigger delay={300} closeDelay={0} render={<span />}>
          {children}
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipPositioner side={side} sideOffset={6}>
            <TooltipPopup className={className}>{label}</TooltipPopup>
          </TooltipPositioner>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  );
}
