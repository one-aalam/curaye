import { useEffect } from "react";
import { useConfigStore } from "@/stores/configStore";
import { ThreePanelLayout } from "@/components/ResizablePanels";
import { ProjectsSidebar } from "@/components/ProjectsSidebar";
import { DocumentTree } from "@/components/DocumentTree";
import { DocumentEditor } from "@/components/DocumentEditor";

export function App() {
  const theme = useConfigStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background text-foreground">
      <ThreePanelLayout
        left={<ProjectsSidebar />}
        middle={<DocumentTree />}
        right={<DocumentEditor />}
      />
    </div>
  );
}
