import { useRef, useCallback, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useConfigStore } from "@/stores/configStore";

interface DividerProps {
  onDrag: (delta: number) => void;
}

function Divider({ onDrag }: DividerProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      lastX.current = e.clientX;

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        onDrag(delta);
      };

      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [onDrag],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        "w-[1px] flex-shrink-0 cursor-col-resize bg-border/50 hover:bg-primary/40 transition-colors",
        "select-none",
      )}
    />
  );
}

interface ThreePanelLayoutProps {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}

const MIN_WIDTH = 120;
const MAX_LEFT = 320;
const MAX_MIDDLE = 400;

export function ThreePanelLayout({ left, middle, right }: ThreePanelLayoutProps) {
  const { leftPanelWidth, middlePanelWidth, setLeftPanelWidth, setMiddlePanelWidth } =
    useConfigStore();

  const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

  const handleLeftDrag = useCallback(
    (delta: number) => {
      setLeftPanelWidth(clamp(leftPanelWidth + delta, MIN_WIDTH, MAX_LEFT));
    },
    [leftPanelWidth, setLeftPanelWidth],
  );

  const handleMiddleDrag = useCallback(
    (delta: number) => {
      setMiddlePanelWidth(clamp(middlePanelWidth + delta, MIN_WIDTH, MAX_MIDDLE));
    },
    [middlePanelWidth, setMiddlePanelWidth],
  );

  return (
    <div className="flex h-full w-full overflow-hidden">
      <div style={{ width: leftPanelWidth, flexShrink: 0 }} className="overflow-hidden">
        {left}
      </div>
      <Divider onDrag={handleLeftDrag} />
      <div style={{ width: middlePanelWidth, flexShrink: 0 }} className="overflow-hidden border-l border-border/30">
        {middle}
      </div>
      <Divider onDrag={handleMiddleDrag} />
      <div className="flex-1 overflow-hidden border-l border-border/30">
        {right}
      </div>
    </div>
  );
}
