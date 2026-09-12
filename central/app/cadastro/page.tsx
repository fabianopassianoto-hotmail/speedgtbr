import type { Metadata } from "next";

import { PublicRegistrationForm } from "@/components/public-registration-form";
import { RegistrationIntro } from "@/components/registration-intro";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadastro de piloto · Speed GT Brasil",
  description: "Cadastre-se na comunidade Speed GT Brasil e receba os próximos passos.",
  robots: { index: false, follow: false },
};

export default function RegistrationPage() {
  return <RegistrationIntro><PublicRegistrationForm /></RegistrationIntro>;
}
