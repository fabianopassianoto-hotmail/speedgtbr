import type { Metadata } from "next";

import { PublicRegistrationForm } from "@/components/public-registration-form";
import { RegistrationIntro } from "@/components/registration-intro";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Atualização cadastral · Speed GT Brasil",
  description: "Formulário de atualização cadastral da Speed GT Brasil.",
  robots: { index: false, follow: false },
};

export default function RegistrationPage() {
  return <RegistrationIntro><PublicRegistrationForm /></RegistrationIntro>;
}
