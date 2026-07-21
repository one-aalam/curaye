import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export const DialogRoot = BaseDialog.Root;
export const DialogTrigger = BaseDialog.Trigger;
export const DialogClose = BaseDialog.Close;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-black/40",
          "transition-opacity duration-200",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
        )}
      />
      <BaseDialog.Popup
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center p-4",
          "transition-[opacity,transform] duration-200",
          "data-starting-style:opacity-0 data-starting-style:scale-95",
          "data-ending-style:opacity-0 data-ending-style:scale-95",
        )}
      >
        <div
          className={cn(
            "relative w-full rounded-xl",
            "border border-(--glass-border) bg-card/95 backdrop-blur-(--glass-blur) shadow-(--glass-shadow)",
            "max-h-[85vh] overflow-y-auto",
            className,
          )}
        >
          {children}
        </div>
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

interface DialogHeaderProps {
  title: string;
  description?: string;
  onClose?: () => void;
}

export function DialogHeader({ title, description, onClose }: DialogHeaderProps) {
  return (
    <div className="flex items-start gap-3 p-5 pb-0">
      <div className="flex-1 min-w-0">
        <DialogTitle className="text-sm font-semibold">{title}</DialogTitle>
        {description !== undefined && (
          <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
            {description}
          </DialogDescription>
        )}
      </div>
      {onClose !== undefined && (
        <DialogClose
          className="rounded p-1 text-muted-foreground hover:bg-accent -mt-0.5 -mr-0.5"
          onClick={onClose}
        >
          <X size={14} />
        </DialogClose>
      )}
    </div>
  );
}
