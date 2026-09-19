import { getProfile } from "@/lib/auth";
import { ProfileForm } from "../components/ProfileForm";
import { redirect } from "next/navigation";

export default async function MePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Profile</h1>
      <p className="muted">
        {profile.role === "developer"
          ? "Companies see these links when you claim a mission. Wallet is required before payout."
          : "This is how your company name appears on missions."}
      </p>
      <ProfileForm profile={profile} />
    </div>
  );
}
