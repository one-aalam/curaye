import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const TabsRoot = BaseTabs.Root;
export const TabsList = BaseTabs.List;
export const TabsPanel = BaseTabs.Panel;

export function TabsTab({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <BaseTabs.Tab
      value={value}
      className={cn(
        "rounded px-2 py-1 text-xs capitalize transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
        "data-active:bg-primary/15 data-active:text-primary data-active:font-medium",
        "text-muted-foreground hover:text-foreground",
        className,
      )}
    >
      {children}
    </BaseTabs.Tab>
  );
}

interface TabItem {
  value: string;
  label: string;
  content: ReactNode;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: TabItem[];
  className?: string;
  listClassName?: string;
}

export function Tabs({ value, onValueChange, tabs, className, listClassName }: TabsProps) {
  return (
    <TabsRoot value={value} onValueChange={onValueChange} className={cn("flex flex-col", className)}>
      <TabsList className={cn("flex gap-1 border-b border-border px-4 py-2", listClassName)}>
        {tabs.map((tab) => (
          <TabsTab key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTab>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsPanel key={tab.value} value={tab.value} className="flex-1 overflow-y-auto outline-none">
          {tab.content}
        </TabsPanel>
      ))}
    </TabsRoot>
  );
}
