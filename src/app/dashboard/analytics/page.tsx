import { BarChart3 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function AnalyticsPage() {
  return (
    <AppShell title="Analytics">
      <ComingSoon
        icon={BarChart3}
        title="Analytics is next"
        description="Conversation volume, response time, and customer ratings are coming soon."
      />
    </AppShell>
  );
}
