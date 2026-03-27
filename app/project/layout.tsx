"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import dynamic from "next/dynamic";

// Lazy-load settings panel — hidden behind toggle, not needed on initial render (bundle-dynamic-imports)
const AISettingsPanel = dynamic(() =>
  import("@/components/ai-settings-panel").then((mod) => mod.AISettingsPanel)
);
import { getSessionId } from "@/lib/session";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, Settings2, PanelLeft } from "lucide-react";

type AIFeatureKey = "gap_analysis" | "preparation" | "mock_interview";

export interface Project {
  id: string;
  name: string;
  company: string | null;
  position: string | null;
  cvText: string | null;
  jobDescription: string | null;
  gapAnalysis: string | null;
  overallScore: number | null;
  createdAt: string;
  updatedAt: string;
  chats: {
    id: string;
    type: string;
    createdAt: string;
  }[];
}

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const pathname = usePathname();

  // Derive the default AI feature from the current page context
  const defaultFeature = ((): AIFeatureKey => {
    // Chat page: /project/[id]/chat/[chatId] — detect chat type
    const chatMatch = pathname.match(/\/project\/([^/]+)\/chat\/([^/]+)/);
    if (chatMatch) {
      const [, projectId, chatId] = chatMatch;
      const project = projects.find((p) => p.id === projectId);
      const chat = project?.chats.find((c) => c.id === chatId);
      if (chat?.type === "preparation") return "preparation";
      if (chat?.type === "mock_interview") return "mock_interview";
      if (chat?.type === "gap_analysis") return "gap_analysis";
    }
    // Project page or fallback: default to gap_analysis
    return "gap_analysis";
  })();

  const fetchProjects = async () => {
    try {
      const sessionId = getSessionId();
      const res = await fetch(`/api/projects?sessionId=${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    }
  };

  // Fetch projects on mount & on navigation; close mobile sidebar on navigate
  useEffect(() => {
    setMobileOpen(false);
    fetchProjects();
  }, [pathname]);

  return (
    <div className="relative flex h-dvh overflow-hidden">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex shrink-0 border-r border-sidebar-border bg-sidebar overflow-hidden transition-[width] duration-300 ease-in-out ${sidebarCollapsed ? "w-0 border-r-0" : "w-72"}`}
      >
        <Sidebar projects={projects} onProjectsChange={fetchProjects} />
      </aside>

      {/* Single persistent sidebar toggle (desktop only) */}
      <button
        onClick={() => setSidebarCollapsed((v) => !v)}
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        style={{ left: sidebarCollapsed ? "0.75rem" : "calc(18rem - 2rem)" }}
        className="absolute top-3 z-40 hidden md:flex rounded-md p-1 text-muted-foreground transition-[left] duration-300 ease-in-out hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <PanelLeft className="size-4" aria-hidden="true" />
      </button>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open menu"
              className="fixed top-3 left-3 z-40 md:hidden"
            />
          }
        >
          <Menu className="size-5" aria-hidden="true" />
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <Sidebar projects={projects} onProjectsChange={fetchProjects} />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <main className="relative flex-1 overflow-hidden">
        {/* Settings toggle button */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle settings"
          className="absolute top-3 right-3 z-30"
          onClick={() => setSettingsOpen((prev) => !prev)}
        >
          <Settings2 className="size-5" aria-hidden="true" />
        </Button>
        {children}
      </main>

      {/* Right settings panel – Desktop (inline) */}
      {settingsOpen && (
        <aside className="hidden lg:flex w-80 shrink-0 border-l">
          <AISettingsPanel onClose={() => setSettingsOpen(false)} defaultFeature={defaultFeature} />
        </aside>
      )}

      {/* Right settings panel – Mobile/Tablet (Sheet) */}
      <div className="lg:hidden">
        <Sheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
        >
          <SheetContent side="right" className="w-80 p-0" showCloseButton={false}>
            <AISettingsPanel onClose={() => setSettingsOpen(false)} defaultFeature={defaultFeature} />
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
