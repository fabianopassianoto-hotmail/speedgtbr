import { requireChatGPTUser } from "@/app/chatgpt-auth";
import { PilotsScreen } from "@/components/pilots-screen";
import {
  ensureCurrentUserAccess,
} from "@/db/access";
import { bootstrapDatabase } from "@/db/bootstrap";
import { getPilotsScreenData } from "@/db/pilots";
import { getRaceEntryData } from "@/db/races";
import { getCashEntries } from "@/db/finance";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireChatGPTUser("/central");
  try {
    await loadHomeData("bootstrap", bootstrapDatabase());
    const access = await loadHomeData("access", ensureCurrentUserAccess(user));

    if (!access) throw new Error("Acesso direto indisponível.");

    const [data, raceData, cashEntries, accessRequests] = await Promise.all([
      loadHomeData("pilots", getPilotsScreenData()),
      loadHomeData("races", getRaceEntryData()),
      access.papel === "administrador"
        ? loadHomeData("cash", getCashEntries())
        : [],
      [],
    ]);

    return (
      <PilotsScreen
        initialPilotos={data.pilotos}
        fila={data.fila}
        formularios={data.formularios}
        formStats={data.formStats}
        campeonatoIniciado={data.campeonatoIniciado}
        raceData={raceData}
        cashEntries={cashEntries}
        accessRequests={accessRequests}
        access={{
          papel: access.papel,
          serie: access.serie,
          email: access.email,
        }}
      />
    );
  } catch (error) {
    console.error("[home:render]", error);
    return <HomeRecovery />;
  }
}

async function loadHomeData<T>(label: string, task: Promise<T>): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[home:${label}]`, error);
    throw error;
  }
}

function HomeRecovery() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 text-foreground">
      <section className="w-full max-w-lg border-l-4 border-[#60A5FA] bg-[#131722] p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
          Central da liga
        </p>
        <h1 className="font-display mt-2 text-3xl font-bold uppercase">
          Não foi possível carregar os dados
        </h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Seus registros continuam preservados. Atualize a página em alguns
          instantes para tentar novamente.
        </p>
        <a
          href="/central"
          className="mt-5 flex min-h-12 items-center justify-center bg-[#60A5FA] px-4 font-bold uppercase text-[#0A0C10]"
        >
          Tentar novamente
        </a>
      </section>
    </main>
  );
}
