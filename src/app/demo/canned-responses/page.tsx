import { CannedResponsesView } from "@/components/canned/canned-responses-view";
import { demoNotifications, demoUnread } from "@/lib/demo-conversations";

export default function DemoCannedResponsesPage() {
  return (
    <CannedResponsesView demo demoUnread={demoUnread} demoNotifications={demoNotifications} />
  );
}
