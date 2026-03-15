"use client";

import { ConversationMeta } from "@/types";
import { PanelLeft, SquarePen, Settings, Trash2, MessageSquare } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  isMobile: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  onClearAllChats: () => void;
  conversations: ConversationMeta[];
  activeConversationId: string | null;
  onSwitchConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  isLoading: boolean;
  isGenerating: boolean;
}

export function Sidebar({
  isOpen,
  isMobile,
  onToggle,
  onNewChat,
  onOpenSettings,
  onClearAllChats,
  conversations,
  activeConversationId,
  onSwitchConversation,
  onDeleteConversation,
  isGenerating,
}: SidebarProps) {
  // Sort conversations by updatedAt (most recent first)
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const sidebarContent = (
    <div className="flex h-full w-[280px] max-w-[85vw] flex-col md:w-[260px]">
      {/* Top row */}
      <div className="flex items-center justify-between p-3">
        <button
          onClick={onToggle}
          className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Close sidebar"
          aria-label="Close sidebar"
          disabled={isGenerating}
        >
          <PanelLeft size={20} />
        </button>
        <button
          onClick={onNewChat}
          className="rounded-lg p-2 text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="New chat"
          aria-label="Start a new chat"
          disabled={isGenerating}
        >
          <SquarePen size={20} />
        </button>
      </div>

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2">
        <div className="flex items-center justify-between gap-2 px-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8e8e8e]">
            History
          </span>
          {sortedConversations.length > 0 && (
            <button
              onClick={onClearAllChats}
              disabled={isGenerating}
              className="rounded-md px-2 py-1 text-[11px] font-semibold text-[#8e8e8e] transition-colors hover:bg-[#2f2f2f] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Clear all history (${sortedConversations.length} conversations)`}
              title={`Clear all history (${sortedConversations.length})`}
            >
              Clear all
            </button>
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          {sortedConversations.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[#8e8e8e]">
              No conversations yet
            </p>
          ) : (
            sortedConversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors ${
                  activeConversationId === conv.id
                    ? "bg-[#2f2f2f] text-[#ececec]"
                    : "text-[#b4b4b4] hover:bg-[#2f2f2f]"
                }`}
              >
                <button
                  onClick={() => onSwitchConversation(conv.id)}
                  disabled={isGenerating}
                  className="flex flex-1 items-center gap-2 text-left min-w-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MessageSquare size={16} className="flex-shrink-0 text-[#8e8e8e]" />
                  <span className="flex-1 truncate text-sm">
                    {conv.title}
                  </span>
                </button>
                <span className="text-[10px] text-[#8e8e8e] flex-shrink-0">
                  {formatDate(conv.updatedAt)}
                </span>
                <div className="flex w-6 flex-shrink-0 justify-end">
                  {conv.messageCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      disabled={isGenerating}
                      className="opacity-0 group-hover:opacity-100 rounded p-1 text-[#8e8e8e] hover:text-red-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Delete conversation"
                      aria-label={`Delete conversation ${conv.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom section */}
      <div className="border-t border-white/[0.08] p-3 space-y-1">
        <button
          onClick={onOpenSettings}
          disabled={isGenerating}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#b4b4b4] hover:bg-[#2f2f2f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Settings size={16} />
          Settings
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={onToggle}
          />
        )}
        {/* Drawer */}
        <div
          aria-hidden={!isOpen}
          inert={!isOpen || undefined}
          className={`fixed inset-y-0 left-0 z-50 bg-[#171717] transition-transform duration-300 ${
            isOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
          }`}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div
      className="flex-shrink-0 overflow-hidden transition-all duration-300 bg-[#171717]"
      style={{ width: isOpen ? 260 : 0 }}
    >
      {sidebarContent}
    </div>
  );
}
