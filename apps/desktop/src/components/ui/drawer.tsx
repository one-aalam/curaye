import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const DrawerRoot = BaseDialog.Root;
export const DrawerTrigger = BaseDialog.Trigger;
export const DrawerClose = BaseDialog.Close;
export const DrawerTitle = BaseDialog.Title;
export const DrawerDescription = BaseDialog.Description;

interface DrawerContentProps {
  children: ReactNode;
  side?: "left" | "right";
  width?: string;
  className?: string;
}

export function DrawerContent({
  children,
  side = "right",
  width = "w-72",
  className,
}: DrawerContentProps) {
  const translateStart = side === "right" ? "data-[starting-style]:translate-x-full" : "data-[starting-style]:-translate-x-full";
  const translateEnd = side === "right" ? "data-[ending-style]:translate-x-full" : "data-[ending-style]:-translate-x-full";
  const position = side === "right" ? "right-0 border-l" : "left-0 border-r";

  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-40 bg-black/30",
          "transition-opacity duration-300",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
        )}
      />
      <BaseDialog.Popup
        className={cn(
          "fixed inset-y-0 z-50 flex flex-col",
          "border-(--glass-border) bg-card/95 backdrop-blur-(--glass-blur) shadow-(--glass-shadow)",
          position,
          width,
          "transition-transform duration-300 ease-out",
          translateStart,
          translateEnd,
          className,
        )}
      >
        {children}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}
