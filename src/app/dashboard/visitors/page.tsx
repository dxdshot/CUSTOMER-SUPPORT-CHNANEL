import { Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ComingSoon } from "@/components/coming-soon";

export default function VisitorsPage() {
  return (
    <AppShell title="Live visitors">
      <ComingSoon
        icon={Users}
        title="Live visitor presence is next"
        description="Open a conversation to see a visitor's device and page history."
      />
    </AppShell>
  );
}
