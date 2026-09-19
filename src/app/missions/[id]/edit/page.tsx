import { getProfile } from "@/lib/auth";
import { getMission } from "@/lib/domain";
import { MissionForm } from "../../../components/MissionForm";
import { notFound, redirect } from "next/navigation";

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const mission = await getMission(id);
  if (!mission) notFound();
  if (mission.company_id !== profile.id) redirect(`/missions/${id}`);
  if (mission.status !== "draft") redirect(`/missions/${id}`);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Edit draft</h1>
      <MissionForm mission={mission} />
    </div>
  );
}
