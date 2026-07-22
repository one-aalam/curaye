import { useEffect, useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { ThreePanelLayout } from "@/components/ResizablePanels";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { DocumentTree } from "@/components/DocumentTree";
import { DocumentEditor } from "@/components/DocumentEditor";
import { AIPalette } from "@/components/AIPalette";

export function App() {
  const theme = useConfigStore((s) => s.theme);
  const openPalette = usePaletteStore((s) => s.openPalette);
  const isPaletteOpen = usePaletteStore((s) => s.open);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k" && !isPaletteOpen) {
        e.preventDefault();
        void openPalette();
      }
    },
    [openPalette, isPaletteOpen],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ThreePanelLayout
        left={<ProjectsSidebar />}
        middle={<DocumentTree />}
        right={<DocumentEditor />}
      />
      <AIPalette />
    </div>
  );
}
