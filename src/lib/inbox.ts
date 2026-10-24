import { currentAgent, type Conversation } from "./mock-data";

export type InboxTab = "all" | "mine" | "unassigned" | "closed";
export type InboxSort = "newest" | "oldest" | "unread";

const isClosed = (conversation: Conversation) => conversation.status === "closed";

/** The list rules shared by the live inbox and the public demo. */
export function visibleConversations(
  items: Conversation[],
  { tab, sort, tag, query }: { tab: InboxTab; sort: InboxSort; tag: string; query: string },
): Conversation[] {
  const needle = query.trim().toLowerCase();

  return items
    .filter((conversation) => {
      if (tab === "mine" && conversation.assignee !== currentAgent) return false;
      if (tab === "unassigned" && conversation.assignee !== null) return false;
      if (tab === "closed" && !isClosed(conversation)) return false;
      if (tab === "all" && isClosed(conversation)) return false;
      if (tag !== "all" && !conversation.tags.some((value) => value.toLowerCase() === tag.toLowerCase())) return false;
      if (!needle) return true;
      const haystack = `${conversation.visitor.name} ${conversation.visitor.email} ${conversation.lastMessage}`.toLowerCase();
      return haystack.includes(needle);
    })
    .sort((a, b) => {
      if (sort === "oldest") return b.updatedMinutes - a.updatedMinutes;
      if (sort === "unread") return b.unread - a.unread || a.updatedMinutes - b.updatedMinutes;
      return a.updatedMinutes - b.updatedMinutes;
    });
}
