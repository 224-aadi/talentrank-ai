import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";

export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect("/screen");

  return <LandingPage />;
}
