import { redirect } from "next/navigation";

export default function SettingsPage() {
  redirect("/configure?tab=llm");
}
