import { getProfile } from "@/lib/auth";
import { ProfileForm } from "../components/ProfileForm";
import { redirect } from "next/navigation";

export default async function MePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return (
    <div className="container-editorial space-y-8 py-16">
      <div>
        <h1 className="text-section">Settings</h1>
        <p className="text-lead mt-3">
          {profile.role === "developer"
            ? "Companies see these links when you claim a mission. Wallet is required before payout."
            : "This is how your company name appears on missions."}
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
