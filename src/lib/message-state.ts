import type { Message } from "./mock-data";

export function receiveMessage(messages: Message[], incoming: Message): Message[] {
  const confirmed: Message = { ...incoming, delivery: "sent" };
  const existing = messages.find((message) => message.id === incoming.id);
  const merged = existing
    ? messages.map((message) => message.id === incoming.id
      ? { ...confirmed, read: message.read || incoming.read }
      : message)
    : [...messages, confirmed];
  return merged.sort((left, right) => {
    if (!left.createdAt || !right.createdAt) return 0;
    return Date.parse(left.createdAt) - Date.parse(right.createdAt);
  });
}

export function failMessage(messages: Message[], id: string): Message[] {
  return messages.map((message) => message.id === id && message.delivery === "sending"
    ? { ...message, delivery: "failed" }
    : message);
}
