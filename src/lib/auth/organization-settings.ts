import { createAdminClient } from "@/lib/db/admin";

export async function getOrganizationSetting(key: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organization_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return (data?.value as string | undefined) ?? null;
}

export async function isSelfSignupAllowed(): Promise<boolean> {
  const value = await getOrganizationSetting("allow_self_signup");
  return (value ?? "true") === "true";
}
