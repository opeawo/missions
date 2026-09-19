import { getProfile } from "@/lib/auth";
import { getMission } from "@/lib/domain";
import { missionIsEditable } from "@/lib/domain/types";
import { MissionForm } from "../../../components/MissionForm";
import { notFound, redirect } from "next/navigation";

export default async function EditMissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const mission = await getMission(id);
  if (!mission) notFound();
  if (mission.company_id !== profile.id) redirect(`/missions/${id}`);
  if (!missionIsEditable(mission)) redirect(`/missions/${id}`);
  return (
    <div className="container-editorial space-y-8 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Edit mission</h1>
      <MissionForm mission={mission} />
    </div>
  );
}
