import { Menu as BaseMenu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const MenuRoot = BaseMenu.Root;
export const MenuTrigger = BaseMenu.Trigger;

type VirtualElement = { getBoundingClientRect: () => DOMRect };

interface MenuContentProps {
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  sideOffset?: number;
  anchor?: Element | VirtualElement | null | (() => Element | VirtualElement | null);
  className?: string;
}

export function MenuContent({
  children,
  side = "bottom",
  align = "start",
  sideOffset = 4,
  anchor,
  className,
}: MenuContentProps) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner side={side} align={align} sideOffset={sideOffset} anchor={anchor}>
        <BaseMenu.Popup
          className={cn(
            "z-50 min-w-40 overflow-hidden rounded-md",
            "border border-(--glass-border) bg-card/90 backdrop-blur-md shadow-lg text-xs",
            "transition-[opacity,transform] duration-150",
            "data-starting-style:opacity-0 data-starting-style:scale-95",
            "data-ending-style:opacity-0 data-ending-style:scale-95",
            className,
          )}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

interface MenuItemProps {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  destructive?: boolean;
}

export function MenuItem({ children, onClick, className, destructive }: MenuItemProps) {
  return (
    <BaseMenu.Item
      onClick={onClick}
      className={cn(
        "flex w-full cursor-default select-none items-center gap-2.5 px-3 py-1.5 text-left outline-none",
        "data-highlighted:bg-accent",
        destructive === true ? "text-destructive" : "text-foreground",
        className,
      )}
    >
      {children}
    </BaseMenu.Item>
  );
}

export function MenuSeparator({ className }: { className?: string }) {
  return <BaseMenu.Separator className={cn("my-1 h-px bg-border/60", className)} />;
}
