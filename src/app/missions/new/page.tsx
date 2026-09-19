import { getProfile } from "@/lib/auth";
import { MissionForm } from "../../components/MissionForm";
import { redirect } from "next/navigation";

export default async function NewMissionPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "company") redirect("/");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Create a mission</h1>
      <p className="muted">Saved as a draft. Publish when you want it live (and on Discord if public).</p>
      <MissionForm />
    </div>
  );
}
