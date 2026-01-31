import { redirect } from "next/navigation";

export default function AgentsPage() {
  redirect("/configure?tab=agents");
}
