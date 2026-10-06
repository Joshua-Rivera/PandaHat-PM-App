"use client";

import { PmDashboard } from "@/components/dashboard/PmDashboard";
import { ResearcherDashboard } from "@/components/dashboard/ResearcherDashboard";
import { useSession } from "@/components/shell/Session";

export default function DashboardPage() {
  const { me } = useSession();
  return me.is_manager ? <PmDashboard /> : <ResearcherDashboard />;
}
