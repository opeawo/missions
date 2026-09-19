import { getProfile } from "@/lib/auth";
import { CreateCampaignWizard } from "../../components/CreateCampaignWizard";
import { redirect } from "next/navigation";

export default async function NewMissionPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "company") redirect("/");
  return (
    <div className="container-editorial py-16 md:py-24">
      <CreateCampaignWizard />
    </div>
  );
}
