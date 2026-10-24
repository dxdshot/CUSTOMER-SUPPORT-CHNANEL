import { WidgetView } from "@/components/widget/widget-view";
import { demoNotifications, demoUnread } from "@/lib/demo-conversations";

export default function DemoWidgetPage() {
  return (
    <WidgetView demo demoUnread={demoUnread} demoNotifications={demoNotifications} />
  );
}
