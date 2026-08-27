import { redirect } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";

export default async function RootPage() {
  redirect((await isLoggedIn()) ? "/dashboard" : "/login");
}
