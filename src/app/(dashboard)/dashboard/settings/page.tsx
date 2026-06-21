import { redirect } from "next/navigation";

const LEGACY_TAB_ROUTES: Record<string, string> = {
  general: "/dashboard/settings/general",
  sidebar: "/dashboard/settings/sidebar",
};

type SettingsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function resolveSettingsRoute(value: string | undefined): string {
  return value
    ? LEGACY_TAB_ROUTES[value] || "/dashboard/settings/general"
    : "/dashboard/settings/general";
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : {};
  const tab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  redirect(resolveSettingsRoute(tab));
}
