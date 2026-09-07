import { AppGate } from "@/components/auth/AppGate";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default function HomePage() {
  return (
    <AppGate>
      <DashboardShell />
    </AppGate>
  );
}
