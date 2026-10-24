import { SettingsView } from "@/components/settings/settings-view";
import { demoNotifications, demoUnread } from "@/lib/demo-conversations";

export default function DemoSettingsPage() {
  return (
    <SettingsView demo demoUnread={demoUnread} demoNotifications={demoNotifications} />
  );
}
