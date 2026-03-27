"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import {
  Plus,
  MessageSquare,
  Search,
  PanelLeftClose,
  Mic,
  ChevronRight,
  MoreHorizontal,
  Trash2,
  GraduationCap,
  User,
  Settings,
  Globe,
  HelpCircle,
  Info,
  LogOut,
  Check,
  Bot,
} from "lucide-react";
import { NewProjectDialog } from "@/components/new-project-dialog";
import { useI18n, type Locale } from "@/lib/i18n";
import type { Project } from "@/app/project/layout";

const CHAT_TYPE_ICONS: Record<string, React.ElementType> = {
  kickoff: Bot,
  preparation: GraduationCap,
  gap_analysis: Search,
  mock_interview: Mic,
};

const CHAT_TYPE_COLORS: Record<string, string> = {
  kickoff: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  preparation: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  gap_analysis: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  mock_interview: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const LANGUAGE_OPTIONS: { value: Locale; label: string }[] = [
  { value: "de", label: "Deutsch" },
  { value: "en", label: "English" },
];

interface SidebarProps {
  projects: Project[];
  onProjectsChange: () => void;
  onCollapse?: () => void;
}

export function Sidebar({ projects, onProjectsChange, onCollapse }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set()
  );
  const [manuallyCollapsed, setManuallyCollapsed] = useState<Set<string>>(
    new Set()
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  // Auto-expand active project
  const activeProjectId = pathname.match(/\/project\/([^/]+)/)?.[1];
  const activeChatId = pathname.match(/\/chat\/([^/]+)/)?.[1];

  const toggleProject = (id: string) => {
    if (isProjectExpanded(id)) {
      // Collapse: remove from expanded, add to manually collapsed
      setExpandedProjects((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setManuallyCollapsed((prev) => new Set(prev).add(id));
    } else {
      // Expand: add to expanded, remove from manually collapsed
      setExpandedProjects((prev) => new Set(prev).add(id));
      setManuallyCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const isProjectExpanded = (id: string) =>
    expandedProjects.has(id) || (id === activeProjectId && !manuallyCollapsed.has(id));

  const deleteProject = async (id: string) => {
    if (!window.confirm(t("sidebar.confirmDeleteProject"))) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        onProjectsChange();
        if (activeProjectId === id) {
          router.push("/project");
        }
      }
    } catch (err) {
      console.error("Failed to delete project:", err);
    }
  };

  const deleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(t("sidebar.confirmDeleteChat"))) return;
    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (res.ok) {
        onProjectsChange();
        if (activeChatId === chatId) {
          router.push(`/project/${activeProjectId}`);
        }
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
  };

  const getChatLabel = (type: string) => {
    const key = `chatType.${type}` as "chatType.kickoff" | "chatType.preparation" | "chatType.gap_analysis" | "chatType.mock_interview";
    return t(key) || type;
  };

  return (
    <div className="flex h-full w-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Image src="/logo.png" alt="Interview Mentor" width={24} height={24} className="shrink-0" />
        <h1 className="flex-1 text-sm font-semibold">Interview Mentor</h1>
        {onCollapse && (
          <button
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <PanelLeftClose className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <Separator />

      {/* New Project Button */}
      <div className="px-3 py-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={() => setDialogOpen(true)}
        >
          <Plus className="size-4" />
          {t("sidebar.newProject")}
        </Button>
      </div>

      <Separator />

      {/* Project List */}
      <ScrollArea className="flex-1">
        <div className="px-2 py-1">
          {projects.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t("sidebar.noProjects")}
              <br />
              {t("sidebar.createFirst")}
            </p>
          )}
          {projects.map((project) => (
            <div key={project.id} className="mb-1">
              {/* Project Header */}
              <div
                className={`group flex items-center rounded-lg ${
                  activeProjectId === project.id && !activeChatId
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/50"
                }`}
              >
                <button
                  onClick={() => toggleProject(project.id)}
                  aria-label={isProjectExpanded(project.id) ? "Collapse project" : "Expand project"}
                  className="flex items-center p-1.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChevronRight
                    className={`size-3.5 text-muted-foreground transition-transform ${
                      isProjectExpanded(project.id) ? "rotate-90" : ""
                    }`}
                  />
                </button>
                <Link
                  href={`/project/${project.id}`}
                  className="flex-1 truncate py-1.5 pr-1 text-sm"
                >
                  <span className="font-medium">{project.name}</span>
                  {project.company && (
                    <span className="ml-1 text-muted-foreground">
                      @ {project.company}
                    </span>
                  )}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100"
                      />
                    }
                  >
                    <MoreHorizontal className="size-3.5" aria-hidden="true" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => deleteProject(project.id)}
                    >
                      <Trash2 className="mr-2 size-3.5" />
                      {t("sidebar.deleteProject")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Chat List (expanded) */}
              {isProjectExpanded(project.id) && (
                <div className="ml-4 border-l border-sidebar-border pl-2">
                  {project.chats.length === 0 && (
                    <p className="px-2 py-1 text-xs text-muted-foreground">
                      {t("sidebar.noChats")}
                    </p>
                  )}
                  {project.chats.map((chat) => {
                    const Icon = CHAT_TYPE_ICONS[chat.type] || MessageSquare;
                    const isActive = activeChatId === chat.id;

                    return (
                      <Link
                        key={chat.id}
                        href={`/project/${project.id}/chat/${chat.id}`}
                        className={`group/chat flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          isActive
                            ? "bg-sidebar-accent font-medium"
                            : "hover:bg-sidebar-accent/50"
                        }`}
                      >
                        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate">{getChatLabel(chat.type)}</span>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="ml-auto opacity-0 group-hover/chat:opacity-100"
                                onClick={(e) => deleteChat(chat.id, e)}
                              />
                            }
                          >
                            <Trash2 className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent>{t("sidebar.deleteChat")}</TooltipContent>
                        </Tooltip>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Profile Menu */}
      <Separator />
      <div className="px-3 py-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-sidebar-accent/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
            }
          >
            <div className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <User className="size-4" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-medium leading-none">Nick</p>
              <p className="text-xs text-muted-foreground">Pro plan</p>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" sideOffset={8} align="start" className="w-56">
            {/* Settings - disabled */}
            <DropdownMenuItem className="text-muted-foreground pointer-events-none">
              <Settings className="mr-2 size-4" />
              {t("profile.settings")}
            </DropdownMenuItem>

            {/* Language - active submenu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Globe className="mr-2 size-4" />
                {t("profile.language")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {LANGUAGE_OPTIONS.map((lang) => (
                  <DropdownMenuItem
                    key={lang.value}
                    onClick={() => setLocale(lang.value)}
                  >
                    <span className="flex-1">{lang.label}</span>
                    {locale === lang.value && (
                      <Check className="ml-2 size-4" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Help - disabled */}
            <DropdownMenuItem className="text-muted-foreground pointer-events-none">
              <HelpCircle className="mr-2 size-4" />
              {t("profile.help")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* About - disabled */}
            <DropdownMenuItem className="text-muted-foreground pointer-events-none">
              <Info className="mr-2 size-4" />
              {t("profile.about")}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Logout - disabled */}
            <DropdownMenuItem className="text-muted-foreground pointer-events-none">
              <LogOut className="mr-2 size-4" />
              {t("profile.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onProjectsChange}
      />
    </div>
  );
}
