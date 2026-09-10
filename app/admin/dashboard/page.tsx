import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import DashboardClient from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return <DashboardClient adminName={admin.profile.role} />;
}
