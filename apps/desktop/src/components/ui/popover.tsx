import { Popover as BasePopover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const PopoverRoot = BasePopover.Root;
export const PopoverTrigger = BasePopover.Trigger;
export const PopoverClose = BasePopover.Close;

type VirtualElement = { getBoundingClientRect: () => DOMRect };

interface PopoverContentProps {
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  anchor?: Element | VirtualElement | null | (() => Element | VirtualElement | null);
  className?: string;
}

export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 8,
  anchor,
  className,
}: PopoverContentProps) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor}>
        <BasePopover.Popup
          className={cn(
            "z-50 overflow-hidden rounded-lg text-xs",
            "border border-(--glass-border) bg-card/90 backdrop-blur-(--glass-blur) shadow-(--glass-shadow)",
            "transition-[opacity,transform,scale] duration-150",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            className,
          )}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}
