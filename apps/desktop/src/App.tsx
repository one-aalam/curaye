import { useEffect, useCallback } from "react";
import { useConfigStore } from "@/stores/configStore";
import { usePaletteStore } from "@/stores/paletteStore";
import { useViewStore } from "@/stores/viewStore";
import { useBriefStore } from "@/stores/briefStore";
import { ThreePanelLayout } from "@/components/ResizablePanels";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { DocumentTree } from "@/components/DocumentTree";
import { DocumentEditor } from "@/components/DocumentEditor";
import { BriefView } from "@/components/BriefView";
import { AIPalette } from "@/components/AIPalette";
import { BacklogView } from "@/components/BacklogView";
import { ReleaseView } from "@/components/ReleaseView";
import { DriftPanel } from "@/components/DriftPanel";
import { SharedLayerPanel } from "@/components/SharedLayerPanel";

export function App() {
  const theme = useConfigStore((s) => s.theme);
  const uiFont = useConfigStore((s) => s.uiFont);
  const openPalette = usePaletteStore((s) => s.openPalette);
  const isPaletteOpen = usePaletteStore((s) => s.open);
  const view = useViewStore((s) => s.view);
  const briefActive = useBriefStore((s) => s.active);

  useEffect(() => {
    const html = document.documentElement;
    html.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const html = document.documentElement;
    if (uiFont === "inter") {
      html.removeAttribute("data-ui-font");
    } else {
      html.setAttribute("data-ui-font", uiFont);
    }
  }, [uiFont]);

  useEffect(() => {
    // Mark the document as running inside Tauri so vibrancy CSS rules apply
    document.documentElement.classList.add("tauri");
  }, []);

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
    <div
      className="h-screen w-screen overflow-hidden text-foreground relative vibrancy-bg"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage: [
          "radial-gradient(ellipse 60% 50% at 80% 5%, color-mix(in srgb, var(--color-gold) 22%, transparent), transparent 100%)",
          "radial-gradient(ellipse 55% 40% at 5% 90%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 100%)",
        ].join(", "),
      }}
    >
      <ThreePanelLayout
        left={<ProjectsSidebar />}
        middle={<DocumentTree />}
        right={briefActive ? <BriefView /> : <DocumentEditor />}
      />
      <AIPalette />
      {view === "backlog" && <BacklogView />}
      {view === "releases" && <ReleaseView />}
      <DriftPanel />
      <SharedLayerPanel />
    </div>
  );
}
