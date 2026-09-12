"use client";

import {
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Flag,
  House,
  ImageDown,
  FileSpreadsheet,
  ListOrdered,
  MessageCircle,
  Search,
  Trophy,
  Trash2,
  UserRound,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";

import { FilterChips } from "@/components/filter-chips";
import { Button } from "@/components/ui/button";
import { PilotCompetitionConfig } from "@/components/race-entry-screen";
import { StandingsScreen } from "@/components/standings-screen";
import { BulletinScreen } from "@/components/bulletin-screen";
import { CashScreen, type CashEntryDraft } from "@/components/cash-screen";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QueueScreen } from "@/components/queue-screen";
import { HomeScreen } from "@/components/home-screen";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  PendingFormListItem,
  PilotListItem,
  QueueListItem,
  Serie,
  MonthlyFormStats,
} from "@/db/pilots";
import type { AccessRequest } from "@/db/access";
import type { CashEntry } from "@/db/finance";
import type { AvailableRacePilot, RaceCompetition, RaceDivision, RacePilot, RaceResult, RaceStage } from "@/db/races";
import { cn } from "@/lib/utils";
import { GENERAL_WHATSAPP_GROUP_URL } from "@/lib/whatsapp-groups";
import { downloadXlsx } from "@/lib/xlsx-client";

type Filter = string;
type Screen = "inicio" | "pilotos" | "classificacao" | "boletim" | "caixa" | "fila";
type ListRecord = PilotListItem | QueueListItem | PendingFormListItem;

const GENERAL_COMPETITION = "__cadastro_geral__";

type AccessSummary = {
  papel: "administrador" | "coordenador";
  serie: string | null;
  email: string;
};

type UndoAction =
  | {
      kind: "campo";
      recordKind: "piloto" | "fila";
      recordId: string;
      field: string;
      oldValue: unknown;
    }
  | {
      kind: "pagamento";
      pilotId: string;
      pagamentoId: number;
    }
  | {
      kind: "campeonato";
      pilotId: string;
      oldSerie: Serie;
      oldSituacao: "ativo" | "suplente" | "inativo" | "saiu";
    };

const statusFilters: Array<{ value: Filter; label: string }> = [
  { value: "todos", label: "Todos" },
  { value: "ex_pilotos", label: "Ex-pilotos" },
  { value: "suplentes", label: "Suplentes" },
  { value: "fila", label: "Fila" },
  { value: "formularios", label: "Formulários" },
  { value: "pendentes", label: "Pagamento pendente" },
  { value: "incompletos", label: "Cadastro incompleto" },
  { value: "arquivados", label: "Arquivados" },
];

const navItems = [
  { value: "inicio", label: "Início", icon: House, enabled: true },
  { value: "pilotos", label: "Pilotos", icon: Users, enabled: true },
  { value: "classificacao", label: "Classificação", icon: Trophy, enabled: true },
  { value: "caixa", label: "Caixa", icon: CircleDollarSign, enabled: true },
  { value: "fila", label: "Fila", icon: ListOrdered, enabled: true },
];

const seriesColor: Record<Serie, string> = {
  A: "#60A5FA",
  B: "#00E676",
  C: "#E8604C",
};

type PilotFilterData = {
  competicoes: RaceCompetition[];
  divisoes: RaceDivision[];
  pilotos: RacePilot[];
};

function filterPilotRecords({
  filter,
  query,
  pilotCompetition,
  pilotos,
  fila,
  formularios,
  raceData,
}: {
  filter: Filter;
  query: string;
  pilotCompetition: string;
  pilotos: PilotListItem[];
  fila: QueueListItem[];
  formularios: PendingFormListItem[];
  raceData: PilotFilterData;
}) {
  const normalizedQuery = normalize(query);
  const showingGeneralRegister = pilotCompetition === GENERAL_COMPETITION;
  const divisionCode = filter.startsWith("divisao:")
    ? filter.slice("divisao:".length)
    : null;
  const pool: ListRecord[] =
    filter === "fila"
      ? fila
      : filter === "ex_pilotos"
        ? pilotos
        : filter === "formularios"
          ? formularios
          : filter === "arquivados" && showingGeneralRegister
            ? [...pilotos, ...fila]
            : filter === "todos" && showingGeneralRegister
              ? [...pilotos, ...fila]
              : pilotos;

  return pool.filter((record) => {
    const competitionEnrollment =
      record.kind === "piloto"
        ? raceData.pilotos.find(
            (enrollment) =>
              enrollment.temporadaId === pilotCompetition &&
              enrollment.id === record.id,
          )
        : null;
    const selectedCompetitionStatus = raceData.competicoes.find(
      (competition) => competition.id === pilotCompetition,
    )?.status;
    const enrollmentDivisionStatus = competitionEnrollment
      ? raceData.divisoes.find(
          (division) =>
            division.temporadaId === competitionEnrollment.temporadaId &&
            division.codigo === competitionEnrollment.serie,
        )?.status
      : null;

    if (
      record.kind === "piloto" &&
      !showingGeneralRegister &&
      (selectedCompetitionStatus === "cancelada" ||
        enrollmentDivisionStatus === "cancelada")
    ) {
      return false;
    }
    if (
      record.kind === "piloto" &&
      !showingGeneralRegister &&
      !competitionEnrollment
    ) {
      return false;
    }
    if (
      divisionCode &&
      (record.kind !== "piloto" ||
        competitionEnrollment?.serie !== divisionCode ||
        competitionEnrollment?.situacao === "saiu")
    ) {
      return false;
    }
    if (
      filter === "suplentes" &&
      (record.kind !== "piloto" ||
        (showingGeneralRegister
          ? record.situacao !== "suplente"
          : competitionEnrollment?.situacao !== "suplente"))
    ) {
      return false;
    }
    if (
      filter === "ex_pilotos" &&
      (record.kind !== "piloto" ||
        (showingGeneralRegister
          ? record.situacao !== "saiu"
          : competitionEnrollment?.situacao !== "saiu"))
    ) {
      return false;
    }
    if (
      filter === "pendentes" &&
      (record.kind !== "piloto" ||
        record.situacao === "saiu" ||
        !record.inscricaoPendente)
    ) {
      return false;
    }
    if (
      filter === "incompletos" &&
      (record.kind === "formulario" ||
        (record.kind === "piloto" && record.situacao === "saiu") ||
        record.cadastroStatus !== "incompleto")
    ) {
      return false;
    }
    if (
      filter === "arquivados" &&
      (record.kind === "formulario" || !record.arquivadoEm)
    ) {
      return false;
    }
    if (
      filter === "todos" &&
      !normalizedQuery &&
      record.kind === "piloto" &&
      !showingGeneralRegister &&
      competitionEnrollment?.situacao === "saiu"
    ) {
      return false;
    }
    return !normalizedQuery || searchableText(record).includes(normalizedQuery);
  });
}

export function PilotsScreen({
  initialPilotos,
  fila: initialFila,
  formularios: initialForms,
  formStats,
  campeonatoIniciado,
  raceData,
  cashEntries: initialCashEntries,
  access,
  accessRequests: initialAccessRequests,
}: {
  initialPilotos: PilotListItem[];
  fila: QueueListItem[];
  formularios: PendingFormListItem[];
  formStats: MonthlyFormStats;
  campeonatoIniciado: boolean;
  raceData: {
    competicoes: RaceCompetition[];
    divisoes: RaceDivision[];
    etapas: RaceStage[];
    pilotos: RacePilot[];
    resultados: RaceResult[];
    pilotosDisponiveis: AvailableRacePilot[];
  };
  cashEntries: CashEntry[];
  access: AccessSummary;
  accessRequests: AccessRequest[];
}) {
  const [activeScreen, setActiveScreen] = useState<Screen>("inicio");
  const [pilotos, setPilotos] = useState(initialPilotos);
  const [fila, setFila] = useState(initialFila);
  const [formularios, setFormularios] = useState(initialForms);
  const [cashEntries, setCashEntries] = useState(initialCashEntries);
  const [accessRequests, setAccessRequests] = useState(initialAccessRequests);
  const [raceResults] = useState(raceData.resultados);
  const [racePilots, setRacePilots] = useState(raceData.pilotos);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [classificationView,setClassificationView]=useState("tabela");
  const [pilotCompetition, setPilotCompetition] = useState(GENERAL_COMPETITION);
  const [exportSeries, setExportSeries] = useState("todas");
  const [selectedKey, setSelectedKey] = useState<{
    kind: ListRecord["kind"];
    id: string;
  } | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    tone: "saving" | "success" | "error";
  } | null>(null);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    if (media.matches) searchRef.current?.focus();
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      if (event.key === "/" && !isTyping) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    [],
  );

  const pilotFilterData = useMemo<PilotFilterData>(
    () => ({
      competicoes: raceData.competicoes,
      divisoes: raceData.divisoes,
      pilotos: racePilots,
    }),
    [raceData.competicoes, raceData.divisoes, racePilots],
  );

  const records = useMemo(
    () =>
      filterPilotRecords({
        filter,
        query,
        pilotCompetition,
        pilotos,
        fila,
        formularios,
        raceData: pilotFilterData,
      }),
    [fila, filter, formularios, pilotCompetition, pilotFilterData, pilotos, query],
  );

  const pilotFilterOptions = useMemo(
    () => [
      { value: "todos", label: "Todos os pilotos" },
      ...raceData.divisoes
        .filter(
          (division) =>
            pilotCompetition !== GENERAL_COMPETITION &&
            division.temporadaId === pilotCompetition &&
            division.status !== "cancelada",
        )
        .sort((a, b) => a.ordem - b.ordem)
        .map((division) => ({
          value: `divisao:${division.codigo}`,
          label: division.nome,
        })),
      ...statusFilters.filter((item) => item.value !== "todos"),
    ],
    [pilotCompetition, raceData.divisoes],
  );

  const pilotFilterCounts = useMemo(
    () =>
      Object.fromEntries(
        pilotFilterOptions.map((option) => [
          option.value,
          filterPilotRecords({
            filter: option.value,
            query: "",
            pilotCompetition,
            pilotos,
            fila,
            formularios,
            raceData: pilotFilterData,
          }).length,
        ]),
      ),
    [fila, formularios, pilotCompetition, pilotFilterData, pilotFilterOptions, pilotos],
  );

  const selected = useMemo<ListRecord | null>(() => {
    if (!selectedKey) return null;
    if (selectedKey.kind === "piloto") {
      return pilotos.find((pilot) => pilot.id === selectedKey.id) ?? null;
    }
    if (selectedKey.kind === "fila") {
      return fila.find((person) => person.id === selectedKey.id) ?? null;
    }
    return formularios.find((form) => form.id === selectedKey.id) ?? null;
  }, [fila, formularios, pilotos, selectedKey]);

  async function savePilotField(
    pilotId: string,
    field: string,
    newValue: unknown,
    options: { createUndo?: boolean; oldValue?: unknown } = {},
  ): Promise<boolean> {
    const pilot = pilotos.find((item) => item.id === pilotId);
    if (!pilot) return false;
    const oldValue =
      options.oldValue ?? (pilot as unknown as Record<string, unknown>)[field];

    setPilotos((current) =>
      current.map((item) =>
        item.id === pilotId
          ? ({ ...item, [field]: newValue } as PilotListItem)
          : item,
      ),
    );
    setSaveStatus({ message: "Salvando…", tone: "saving" });

    try {
      const response = await fetch(`/central/api/pilotos/${pilotId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: newValue }),
      });
      const result = (await response.json()) as { error?: string; value?: unknown };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");

      setPilotos((current) =>
        current.map((item) =>
          item.id === pilotId
            ? ({ ...item, [field]: result.value } as PilotListItem)
            : item,
        ),
      );
      setSaveStatus({ message: "Salvo", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);

      if (options.createUndo !== false) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoAction({
          kind: "campo",
          recordKind: "piloto",
          recordId: pilotId,
          field,
          oldValue,
        });
        undoTimerRef.current = setTimeout(() => setUndoAction(null), 6_000);
      }
      return true;
    } catch (error) {
      setPilotos((current) =>
        current.map((item) =>
          item.id === pilotId
            ? ({ ...item, [field]: oldValue } as PilotListItem)
            : item,
        ),
      );
      setSaveStatus({
        message: error instanceof Error ? error.message : "Erro ao salvar.",
        tone: "error",
      });
      return false;
    }
  }

  async function saveChampionshipParticipation(
    pilotId: string,
    serie: Serie,
    situacao: "ativo" | "suplente" | "inativo" | "saiu",
    options: { createUndo?: boolean } = {},
  ): Promise<boolean> {
    const pilot = pilotos.find((item) => item.id === pilotId);
    if (!pilot) return false;
    if (!pilot.serie) return false;
    const oldSerie = pilot.serie;
    const oldSituacao = pilot.situacao ?? "ativo";

    setPilotos((current) =>
      current.map((item) =>
        item.id === pilotId ? { ...item, serie, situacao } : item,
      ),
    );
    setSaveStatus({ message: "Salvando…", tone: "saving" });

    try {
      const response = await fetch(`/central/api/pilotos/${pilotId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          field: "participacaoTemporada",
          value: { serie, situacao },
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        serie?: Serie;
        situacao?: "ativo" | "suplente" | "inativo" | "saiu";
      };
      if (!response.ok || !result.serie || !result.situacao) {
        throw new Error(result.error || "Não foi possível salvar a participação.");
      }

      setPilotos((current) =>
        current.map((item) =>
          item.id === pilotId
            ? { ...item, serie: result.serie!, situacao: result.situacao! }
            : item,
        ),
      );
      setSaveStatus({ message: "Salvo", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);

      if (options.createUndo !== false) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoAction({
          kind: "campeonato",
          pilotId,
          oldSerie,
          oldSituacao,
        });
        undoTimerRef.current = setTimeout(() => setUndoAction(null), 6_000);
      }
      return true;
    } catch (error) {
      setPilotos((current) =>
        current.map((item) =>
          item.id === pilotId
            ? { ...item, serie: oldSerie, situacao: oldSituacao }
            : item,
        ),
      );
      setSaveStatus({
        message:
          error instanceof Error ? error.message : "Erro ao salvar participação.",
        tone: "error",
      });
      return false;
    }
  }

  async function saveQueueField(
    recordId: string,
    field: string,
    newValue: unknown,
    options: { createUndo?: boolean; oldValue?: unknown } = {},
  ): Promise<boolean> {
    const person = fila.find((item) => item.id === recordId);
    if (!person) return false;
    const oldValue =
      options.oldValue ?? (person as unknown as Record<string, unknown>)[field];

    setFila((current) =>
      current.map((item) =>
        item.id === recordId
          ? ({ ...item, [field]: newValue } as QueueListItem)
          : item,
      ),
    );
    setSaveStatus({ message: "Salvando…", tone: "saving" });
    try {
      const response = await fetch(`/central/api/fila/${recordId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ field, value: newValue }),
      });
      const result = (await response.json()) as { error?: string; value?: unknown };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar.");
      setFila((current) =>
        current.map((item) =>
          item.id === recordId
            ? ({ ...item, [field]: result.value } as QueueListItem)
            : item,
        ),
      );
      setSaveStatus({ message: "Salvo", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);
      if (options.createUndo !== false) {
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        setUndoAction({
          kind: "campo",
          recordKind: "fila",
          recordId,
          field,
          oldValue,
        });
        undoTimerRef.current = setTimeout(() => setUndoAction(null), 6_000);
      }
      return true;
    } catch (error) {
      setFila((current) =>
        current.map((item) =>
          item.id === recordId
            ? ({ ...item, [field]: oldValue } as QueueListItem)
            : item,
        ),
      );
      setSaveStatus({
        message: error instanceof Error ? error.message : "Erro ao salvar.",
        tone: "error",
      });
      return false;
    }
  }

  async function undoLastChange() {
    if (!undoAction) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const action = undoAction;
    setUndoAction(null);
    if (action.kind === "campo") {
      if (action.recordKind === "piloto") {
        await savePilotField(action.recordId, action.field, action.oldValue, {
          createUndo: false,
        });
      } else {
        await saveQueueField(action.recordId, action.field, action.oldValue, {
          createUndo: false,
        });
      }
      return;
    }
    if (action.kind === "campeonato") {
      await saveChampionshipParticipation(
        action.pilotId,
        action.oldSerie,
        action.oldSituacao,
        { createUndo: false },
      );
      return;
    }

    setSaveStatus({ message: "Desfazendo…", tone: "saving" });
    try {
      const response = await fetch(`/central/api/pilotos/${action.pilotId}/pagamentos`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pagamentoId: action.pagamentoId }),
      });
      const result = (await response.json()) as {
        error?: string;
        totalPago?: number;
        isentoPagamento?: boolean;
        inscricaoPendente?: boolean;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível desfazer.");
      updatePaymentStatus(
        action.pilotId,
        Number(result.totalPago),
        Boolean(result.isentoPagamento),
        Boolean(result.inscricaoPendente),
      );
      setCashEntries((current) => current.filter((entry) => entry.id !== action.pagamentoId));
      setSaveStatus({ message: "Pagamento desfeito", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);
    } catch (error) {
      setSaveStatus({
        message: error instanceof Error ? error.message : "Erro ao desfazer.",
        tone: "error",
      });
    }
  }

  function updatePaymentStatus(
    pilotId: string,
    totalPago: number,
    isentoPagamento: boolean,
    inscricaoPendente: boolean,
  ) {
    setPilotos((current) =>
      current.map((item) =>
        item.id === pilotId
          ? { ...item, totalPago, isentoPagamento, inscricaoPendente }
          : item,
      ),
    );
  }

  async function registerPayment(
    pilotId: string,
    data: string,
    valor: number,
  ): Promise<boolean> {
    setSaveStatus({ message: "Salvando pagamento…", tone: "saving" });
    try {
      const response = await fetch(`/central/api/pilotos/${pilotId}/pagamentos`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data, valor }),
      });
      const result = (await response.json()) as {
        error?: string;
        id?: number;
        entry?: CashEntry;
        totalPago?: number;
        isentoPagamento?: boolean;
        inscricaoPendente?: boolean;
      };
      if (!response.ok || !result.id) {
        throw new Error(result.error || "Não foi possível registrar o pagamento.");
      }
      updatePaymentStatus(
        pilotId,
        Number(result.totalPago),
        Boolean(result.isentoPagamento),
        Boolean(result.inscricaoPendente),
      );
      if (result.entry) setCashEntries((current) => [result.entry!, ...current]);
      setSaveStatus({ message: "Pagamento registrado", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);

      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoAction({
        kind: "pagamento",
        pilotId,
        pagamentoId: result.id,
      });
      undoTimerRef.current = setTimeout(() => setUndoAction(null), 6_000);
      return true;
    } catch (error) {
      setSaveStatus({
        message:
          error instanceof Error ? error.message : "Erro ao registrar pagamento.",
        tone: "error",
      });
      return false;
    }
  }

  async function createCashEntry(draft: CashEntryDraft): Promise<boolean> {
    setSaveStatus({ message: "Salvando pagamento…", tone: "saving" });
    try {
      const response = await fetch("/central/api/caixa", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      const result = (await response.json()) as {
        error?: string;
        entry?: CashEntry;
        status?: { totalPago: number; isentoPagamento: boolean; inscricaoPendente: boolean } | null;
      };
      if (!response.ok || !result.entry) throw new Error(result.error || "Não foi possível cadastrar o pagamento.");
      setCashEntries((current) => [result.entry!, ...current]);
      if (result.entry.pilotoId && result.entry.temporadaId === "2026" && result.status) {
        updatePaymentStatus(result.entry.pilotoId, result.status.totalPago, result.status.isentoPagamento, result.status.inscricaoPendente);
      }
      setSaveStatus({ message: "Pagamento cadastrado", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);
      return true;
    } catch (error) {
      setSaveStatus({ message: error instanceof Error ? error.message : "Erro ao cadastrar pagamento.", tone: "error" });
      return false;
    }
  }

  async function deleteCashEntry(entry: CashEntry): Promise<boolean> {
    setSaveStatus({ message: "Excluindo pagamento…", tone: "saving" });
    try {
      const response = await fetch("/central/api/caixa", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pagamentoId: entry.id }),
      });
      const result = (await response.json()) as {
        error?: string;
        temporadaId?: string;
        pilotoId?: string | null;
        status?: { totalPago: number; isentoPagamento: boolean; inscricaoPendente: boolean } | null;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível excluir o pagamento.");
      setCashEntries((current) => current.filter((item) => item.id !== entry.id));
      if (result.pilotoId && result.temporadaId === "2026" && result.status) {
        updatePaymentStatus(result.pilotoId, result.status.totalPago, result.status.isentoPagamento, result.status.inscricaoPendente);
      }
      setSaveStatus({ message: "Pagamento excluído", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);
      return true;
    } catch (error) {
      setSaveStatus({ message: error instanceof Error ? error.message : "Erro ao excluir pagamento.", tone: "error" });
      return false;
    }
  }

  async function setPaymentExemption(
    pilotId: string,
    isento: boolean,
  ): Promise<boolean> {
    setSaveStatus({ message: "Salvando isenção…", tone: "saving" });
    try {
      const response = await fetch(`/central/api/pilotos/${pilotId}/pagamentos`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ isento }),
      });
      const result = (await response.json()) as {
        error?: string;
        totalPago?: number;
        isentoPagamento?: boolean;
        inscricaoPendente?: boolean;
      };
      if (!response.ok) throw new Error(result.error || "Não foi possível salvar a isenção.");
      updatePaymentStatus(
        pilotId,
        Number(result.totalPago),
        Boolean(result.isentoPagamento),
        Boolean(result.inscricaoPendente),
      );
      setSaveStatus({ message: isento ? "Isenção registrada" : "Isenção removida", tone: "success" });
      window.setTimeout(() => setSaveStatus(null), 1_800);
      return true;
    } catch (error) {
      setSaveStatus({ message: error instanceof Error ? error.message : "Erro ao salvar isenção.", tone: "error" });
      return false;
    }
  }

  async function promoteQueue(
    queueId: string,
    serie: Serie,
    situacao: "ativo" | "suplente",
  ): Promise<boolean> {
    setSaveStatus({ message: "Promovendo…", tone: "saving" });
    try {
      const response = await fetch(`/central/api/fila/${queueId}/promover`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serie, situacao }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível promover.");
      setSaveStatus({ message: "Pessoa promovida", tone: "success" });
      window.location.reload();
      return true;
    } catch (error) {
      setSaveStatus({
        message: error instanceof Error ? error.message : "Erro ao promover.",
        tone: "error",
      });
      return false;
    }
  }

  async function copyRegistrationLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/cadastro`);
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 1_800);
    } catch {
      setSaveStatus({
        message: "Não foi possível copiar o link.",
        tone: "error",
      });
    }
  }

  function exportPilotsAndPhones() {
    const competitionId =
      pilotCompetition === GENERAL_COMPETITION
        ? raceData.competicoes.find((item) => item.status === "ativa")?.id
        : pilotCompetition;
    if (!competitionId) {
      setSaveStatus({ message: "Escolha uma competição para exportar.", tone: "error" });
      return;
    }
    const selectedSeries = exportSeries === "todas" ? ["A", "B", "C"] : [exportSeries];
    const enrollmentRows = racePilots
      .filter(
        (item) =>
          item.temporadaId === competitionId &&
          selectedSeries.includes(item.serie) &&
          item.situacao !== "saiu" &&
          !item.pilotoArquivado,
      )
      .sort((a, b) => a.serie.localeCompare(b.serie) || a.apelido.localeCompare(b.apelido, "pt-BR"));
    downloadXlsx(
      `pilotos-telefones-${competitionId}-${exportSeries}.xlsx`,
      "Pilotos e telefones",
      [
        ["Série", "Piloto", "Nome completo", "Telefone / WhatsApp", "Situação", "Código"],
        ...enrollmentRows.map((item) => {
          const pilot = pilotos.find((entry) => entry.id === item.id);
          return [item.serie, item.apelido, pilot?.nomeCompleto ?? "", pilot?.whatsapp ?? "", item.situacao ?? "ativo", item.id];
        }),
      ],
    );
    setSaveStatus({ message: `${enrollmentRows.length} pilotos exportados em XLSX.`, tone: "success" });
    window.setTimeout(() => setSaveStatus(null), 2_200);
  }

  function handleMembershipChange(
    pilotId: string,
    temporadaId: string,
    serie: string,
    situacao: MembershipStatus,
  ) {
    setRacePilots((current) => {
      const existing = current.find(
        (pilot) => pilot.id === pilotId && pilot.temporadaId === temporadaId,
      );
      if (existing) {
        return current.map((pilot) =>
          pilot.id === pilotId && pilot.temporadaId === temporadaId
            ? { ...pilot, serie, situacao }
            : pilot,
        );
      }

      const pilot = pilotos.find((item) => item.id === pilotId);
      if (!pilot) return current;
      return [
        ...current,
        {
          id: pilotId,
          apelido: pilot.apelido,
          simgrid: pilot.simgrid,
          temporadaId,
          serie,
          situacao,
          pilotoArquivado: Boolean(pilot.arquivadoEm),
        },
      ];
    });

    if (temporadaId === "2026") {
      setPilotos((current) =>
        current.map((pilot) =>
          pilot.id === pilotId
            ? { ...pilot, serie: serie as Serie, situacao }
            : pilot,
        ),
      );
    }
  }

  function handleMembershipRemove(pilotId: string, temporadaId: string) {
    setRacePilots((current) => current.filter((pilot) => !(pilot.id === pilotId && pilot.temporadaId === temporadaId)));
    if (temporadaId === "2026") {
      setPilotos((current) => current.map((pilot) => pilot.id === pilotId ? { ...pilot, serie: null, situacao: null, isentoPagamento: false, inscricaoPendente: false } : pilot));
    }
  }

  const currentSeasonClassificationPilots: RacePilot[] = pilotos
    .filter(
      (pilot) =>
        Boolean(pilot.serie) &&
        pilot.situacao !== "saiu" &&
        !pilot.arquivadoEm,
    )
    .map((pilot) => ({
      id: pilot.id,
      apelido: pilot.apelido,
      simgrid: pilot.simgrid,
      temporadaId: "2026",
      serie: pilot.serie!,
      situacao: pilot.situacao,
      pilotoArquivado: false,
    }));
  const classificationPilots: RacePilot[] = [
    ...racePilots.filter((pilot) => pilot.temporadaId !== "2026"),
    ...currentSeasonClassificationPilots,
  ];
  const activeCompetitionName =
    raceData.competicoes.find((competition) => competition.status === "ativa")
      ?.nome ?? "Competição não definida";

  const selectedEditable =
    selected?.kind === "fila"
      ? access.papel === "administrador"
      : selected?.kind === "piloto" &&
        (access.papel === "administrador" || access.serie === selected.serie);

  return (
    <div className="league-app min-h-dvh bg-background text-foreground">
      <header className="border-b border-border bg-[#0D1016]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image
            src="/central/brand/speed-gt-brasil.png"
              alt="Speed GT Brasil"
              width={56}
              height={56}
              priority
              unoptimized
              className="size-12 shrink-0 object-contain md:size-14"
            />
            <div className="min-w-0">
              <p className="font-display truncate text-xl font-bold uppercase tracking-wide md:text-2xl">
                Central da liga
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {activeCompetitionName} · {access.papel === "administrador" ? "Administrador" : `Coordenação Série ${access.serie ?? "pendente"}`}
              </p>
            </div>
          </div>
          <Image
            src="/central/brand/max-lima.png"
            alt="Max Lima Racing Broadcaster"
            width={144}
            height={48}
            unoptimized
            className="h-7 w-20 shrink-0 object-contain object-right sm:h-9 sm:w-28 md:w-36"
          />
        </div>
        <div className="mx-auto max-w-6xl px-4 md:px-6"><a href="/" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">Voltar ao site Speed GT Brasil</a></div><DesktopNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />
      </header>

      <div hidden={activeScreen !== "inicio"}>
        <HomeScreen
          access={access}
          pilots={pilotos}
          queue={fila}
          forms={formularios}
          formStats={formStats}
          competitions={raceData.competicoes}
          divisions={raceData.divisoes}
          stages={raceData.etapas}
          racePilots={classificationPilots}
          results={raceResults}
          accessRequests={accessRequests}
          onNavigate={setActiveScreen}
          onCopyRegistration={copyRegistrationLink}
          registrationCopied={linkCopied}
          onOpenPilot={(id) => setSelectedKey({ kind: "piloto", id })}
        />
      </div>

      <div hidden={activeScreen !== "pilotos"}>
      <main className="mx-auto max-w-6xl px-3 pb-28 md:px-6 md:pb-10">
        <section className="sticky top-0 z-30 -mx-3 border-b border-border bg-background/95 px-3 pb-3 pt-4 backdrop-blur md:-mx-6 md:px-6 md:pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#60A5FA]">
                Consulta rápida
              </p>
              <h1 className="font-display text-4xl font-bold uppercase leading-none md:text-5xl">
                Pilotos
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {access.papel === "administrador" && (
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={copyRegistrationLink} className="flex min-h-11 items-center gap-2 border border-[#60A5FA] px-3 text-xs font-bold text-[#60A5FA] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"><Copy className="size-4" aria-hidden="true" />{linkCopied ? "Link copiado" : "Copiar formulário"}</button>
                  <select aria-label="Séries para exportar" value={exportSeries} onChange={(event)=>setExportSeries(event.target.value)} className="h-11 border border-border bg-[#131722] px-2 text-xs font-semibold"><option value="todas">Séries A, B e C</option><option value="A">Somente Série A</option><option value="B">Somente Série B</option><option value="C">Somente Série C</option></select>
                  <button type="button" onClick={exportPilotsAndPhones} className="flex min-h-11 items-center gap-2 bg-[#60A5FA] px-3 text-xs font-bold text-[#0A0C10]"><FileSpreadsheet className="size-4"/>Exportar XLSX</button>
                </div>
              )}
              <p className="font-data hidden text-xs text-muted-foreground lg:block">
                / foca a busca · Esc fecha a ficha
              </p>
            </div>
          </div>

          <label className="relative mt-4 block">
            <span className="sr-only">Buscar piloto</span>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Apelido, nome, PSN, SimGrid, cidade ou telefone"
              className="h-12 rounded-none border-border bg-[#131722] pl-12 text-base shadow-none placeholder:text-[#8A92A6] focus-visible:border-[#60A5FA] focus-visible:ring-[#60A5FA]/30"
              autoComplete="off"
            />
          </label>

          <div className="mt-3 space-y-2" aria-label="Filtros de pilotos">
            <FilterChips label="Competição" value={pilotCompetition} onChange={v=>{setPilotCompetition(v);setFilter("todos")}} options={[{value:GENERAL_COMPETITION,label:"Cadastro geral"},...raceData.competicoes.filter(c=>c.status!=="cancelada").map(c=>({value:c.id,label:c.nome}))]}/>
            <FilterChips label="Exibir" value={filter} onChange={setFilter} options={pilotFilterOptions.map(item=>({value:item.value,label:item.label+" · "+(pilotFilterCounts[item.value]??0)}))}/>
          </div>
        </section>

        {access.papel === "administrador" && accessRequests.length > 0 && (
          <AccessRequestsPanel
            requests={accessRequests}
            divisions={raceData.divisoes.filter((division) => division.status === "ativa")}
            onResolved={(id) =>
              setAccessRequests((current) => current.filter((item) => item.id !== id))
            }
          />
        )}

        <section className="pt-4" aria-live="polite">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              {records.length} {records.length === 1 ? "resultado" : "resultados"}
            </p>
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="min-h-11 px-2 text-sm text-[#60A5FA] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[#60A5FA]"
              >
                Limpar busca
              </button>
            )}
          </div>

          {records.length > 0 ? (
            <div className="border-y border-border">
              {records.map((record) => (
                <TimingRow
                  key={`${record.kind}-${record.id}`}
                  record={record}
                  onSelect={() =>
                    setSelectedKey({ kind: record.kind, id: record.id })
                  }
                />
              ))}
            </div>
          ) : (
            <div className="border-l-4 border-[#60A5FA] bg-[#131722] p-5">
              <p className="font-display text-2xl font-bold uppercase">
                {filter === "ex_pilotos" ? "Nenhum ex-piloto" : "Nenhum resultado"}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {filter === "ex_pilotos"
                  ? "Quando alguém for marcado como “Não vai participar”, aparecerá aqui com o histórico da saída."
                  : "Tente outro nome ou retire um dos filtros. A busca aceita partes do apelido, PSN, SimGrid, cidade e telefone."}
              </p>
            </div>
          )}
        </section>
        {access.papel === "administrador" && (
          <PilotCompetitionConfig competitions={raceData.competicoes} divisions={raceData.divisoes} stages={raceData.etapas} enrolledPilots={racePilots} availablePilots={raceData.pilotosDisponiveis} selectedCompetition={pilotCompetition === GENERAL_COMPETITION ? raceData.competicoes.find((item)=>item.status==="ativa")?.id ?? raceData.competicoes[0]?.id ?? "" : pilotCompetition}/>
        )}
      </main>
      </div>
      <div hidden={activeScreen !== "classificacao" && activeScreen !== "boletim"}>
        <div className="mx-auto max-w-6xl px-3 pt-4 md:px-6"><FilterChips label="Classificação" value={activeScreen==="boletim"?"boletim":classificationView} onChange={v=>{setClassificationView(v);setActiveScreen("classificacao")}} options={[{value:"tabela",label:"Classificação"},{value:"boletim",label:"Boletim e exportação"}]}/></div>
        <div hidden={activeScreen==="boletim"||classificationView!=="tabela"}><StandingsScreen
          competitions={raceData.competicoes}
          divisions={raceData.divisoes}
          stages={raceData.etapas}
          pilots={classificationPilots}
          results={raceResults}
          onOpenPilot={(id) => setSelectedKey({ kind: "piloto", id })}
        />
      </div>
      <div hidden={activeScreen !== "boletim" && (activeScreen!=="classificacao" || classificationView!=="boletim")}>
        <BulletinScreen
          competitions={raceData.competicoes}
          divisions={raceData.divisoes}
          stages={raceData.etapas}
          pilots={classificationPilots}
          results={raceResults}
        />
      </div>
      </div>
      <div hidden={activeScreen !== "caixa"}>
        <CashScreen
          competitions={raceData.competicoes}
          entries={cashEntries}
          pilots={pilotos}
          isAdmin={access.papel === "administrador"}
          onOpenPilot={(id) => setSelectedKey({ kind: "piloto", id })}
          onCreateEntry={createCashEntry}
          onDeleteEntry={deleteCashEntry}
        />
      </div>
      <div hidden={activeScreen !== "fila"}>
        <QueueScreen
          people={fila}
          editable={access.papel === "administrador"}
          onOpenQueue={(id) => setSelectedKey({ kind: "fila", id })}
          onSave={saveQueueField}
        />
      </div>

      <MobileNavigation activeScreen={activeScreen} onNavigate={setActiveScreen} />

      <Sheet
        open={Boolean(selected)}
        onOpenChange={(open) => !open && setSelectedKey(null)}
      >
        <SheetContent
          side={isDesktop ? "right" : "bottom"}
          showCloseButton={false}
          className={cn(
            "gap-0 border-border bg-[#10141B] p-0 text-foreground shadow-none motion-reduce:transition-none",
            isDesktop
              ? "w-[min(480px,42vw)] max-w-none"
              : "h-[92dvh] w-full max-w-none",
          )}
        >
          {selected?.kind === "formulario" ? (
            <PendingFormSheet
              form={selected}
              people={[...pilotos, ...fila]}
              editable={access.papel === "administrador"}
              onResolved={() => {
                setFormularios((current) =>
                  current.filter((item) => item.formularioId !== selected.formularioId),
                );
                setSelectedKey(null);
              }}
            />
          ) : selected ? (
            <RecordSheet
              record={selected}
              raceData={{ ...raceData, pilotos: racePilots, resultados: raceResults }}
              editable={Boolean(selectedEditable)}
              isAdmin={access.papel === "administrador"}
              campeonatoIniciado={campeonatoIniciado}
              cashEntries={cashEntries}
              saveStatus={saveStatus}
              onSave={(field, value) =>
                selected.kind === "piloto"
                  ? savePilotField(selected.id, field, value)
                  : saveQueueField(selected.id, field, value)
              }
              onRegisterPayment={(data, valor) =>
                selected.kind === "piloto"
                  ? registerPayment(selected.id, data, valor)
                  : Promise.resolve(false)
              }
              onSetPaymentExemption={(isento) =>
                selected.kind === "piloto"
                  ? setPaymentExemption(selected.id, isento)
                  : Promise.resolve(false)
              }
              onDeletePayment={deleteCashEntry}
              onPromote={(serie, situacao) =>
                selected.kind === "fila"
                  ? promoteQueue(selected.id, serie, situacao)
                  : Promise.resolve(false)
              }
              onMembershipChange={handleMembershipChange}
              onMembershipRemove={handleMembershipRemove}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      {undoAction && (
        <div
          className="fixed inset-x-3 bottom-20 z-[70] mx-auto flex max-w-md items-center justify-between gap-4 border border-[#60A5FA] bg-[#131722] px-4 py-3 text-sm md:bottom-5"
          role="status"
        >
          <span>
            {undoAction.kind === "pagamento"
              ? "Pagamento registrado."
              : "Alteração salva."}
          </span>
          <button
            type="button"
            onClick={undoLastChange}
            className="min-h-11 px-3 font-semibold text-[#60A5FA] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#60A5FA]"
          >
            Desfazer
          </button>
        </div>
      )}
    </div>
  );
}

function AccessRequestsPanel({
  requests,
  divisions,
  onResolved,
}: {
  requests: AccessRequest[];
  divisions: RaceDivision[];
  onResolved: (id: number) => void;
}) {
  return (
    <section className="mt-4 border-l-4 border-[#00E676] bg-[#131722] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00E676]">
        Acessos aguardando aprovação
      </p>
      <h2 className="font-display mt-1 text-2xl font-bold uppercase">
        {requests.length} {requests.length === 1 ? "solicitação" : "solicitações"}
      </h2>
      <div className="mt-3 space-y-3">
        {requests.map((request) => (
          <AccessRequestRow
            key={request.id}
            request={request}
            divisions={divisions}
            onResolved={() => onResolved(request.id)}
          />
        ))}
      </div>
    </section>
  );
}

function AccessRequestRow({
  request,
  divisions,
  onResolved,
}: {
  request: AccessRequest;
  divisions: RaceDivision[];
  onResolved: () => void;
}) {
  const [role, setRole] = useState<"administrador" | "coordenador">("administrador");
  const [division, setDivision] = useState(divisions[0]?.codigo ?? "");
  const [status, setStatus] = useState("");
  const uniqueDivisions = divisions.filter(
    (item, index, all) => all.findIndex((other) => other.codigo === item.codigo) === index,
  );

  async function resolve(action: "aprovar" | "negar") {
    setStatus(action === "aprovar" ? "Aprovando…" : "Negando…");
    const response = await fetch(`/central/api/acessos/${request.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, papel: role, serie: division }),
    });
    const json = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(json.error ?? "Não foi possível analisar o acesso.");
      return;
    }
    onResolved();
  }

  return (
    <article className="border border-border bg-[#10141B] p-3">
      <div>
        <strong className="block text-base">{request.nome || "Nome não informado"}</strong>
        <span className="font-data break-all text-xs text-muted-foreground">{request.email}</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Permissão</span>
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)} className="h-11 w-full border border-border bg-[#0D1118] px-3">
            <option value="administrador">Administrador</option>
            <option value="coordenador">Coordenador de divisão</option>
          </select>
        </label>
        {role === "coordenador" && (
          <label>
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Divisão</span>
            <select value={division} onChange={(event) => setDivision(event.target.value)} className="h-11 w-full border border-border bg-[#0D1118] px-3">
              {uniqueDivisions.map((item) => <option key={item.codigo} value={item.codigo}>{item.nome}</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => resolve("aprovar")} className="min-h-11 bg-[#00E676] px-4 font-bold text-[#0D1118]">Aprovar</button>
        <button type="button" onClick={() => resolve("negar")} className="min-h-11 border border-[#E8604C] px-4 font-bold text-[#FF8A78]">Negar</button>
        <span aria-live="polite" className="text-sm text-muted-foreground">{status}</span>
      </div>
    </article>
  );
}

function DesktopNavigation({
  activeScreen,
  onNavigate,
}: {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <nav className="mx-auto hidden max-w-6xl border-t border-border px-6 md:flex" aria-label="Navegação principal">
      {navItems.map(({ value, label, icon: Icon, enabled }) => {
        const active = value === activeScreen || (value === "classificacao" && activeScreen === "boletim");
        return (
        <button
          key={label}
          type="button"
          aria-current={active ? "page" : undefined}
          aria-disabled={!enabled}
          disabled={!enabled}
          title={enabled ? undefined : "Tela ainda não construída"}
          onClick={() => enabled && onNavigate(value as Screen)}
          className={cn(
            "flex min-h-12 items-center gap-2 border-b-2 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-[#60A5FA]",
            active
              ? "border-[#60A5FA] text-foreground"
              : "border-transparent text-muted-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </button>
        );
      })}
    </nav>
  );
}

function MobileNavigation({
  activeScreen,
  onNavigate,
}: {
  activeScreen: Screen;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <nav
      className="scrollbar-none fixed inset-x-0 bottom-0 z-40 flex overflow-x-auto border-t border-border bg-[#0D1016] pb-[max(env(safe-area-inset-bottom),0.25rem)] md:hidden"
      aria-label="Navegação principal"
    >
      {navItems.map(({ value, label, icon: Icon, enabled }) => {
        const active = value === activeScreen || (value === "classificacao" && activeScreen === "boletim");
        return (
        <button
          key={label}
          type="button"
          aria-current={active ? "page" : undefined}
          aria-disabled={!enabled}
          disabled={!enabled}
          title={enabled ? undefined : "Tela ainda não construída"}
          onClick={() => enabled && onNavigate(value as Screen)}
          className={cn(
            "flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold leading-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#60A5FA]",
            active ? "text-[#60A5FA]" : "text-[#6F788B]",
          )}
        >
          <Icon className="size-5" aria-hidden="true" />
          <span className="max-w-full truncate">{value==="classificacao"?"Classif.":label}</span>
        </button>
        );
      })}
    </nav>
  );
}

function TimingRow({
  record,
  onSelect,
}: {
  record: ListRecord;
  onSelect: () => void;
}) {
  const incomplete =
    record.kind !== "formulario" &&
    !(record.kind === "piloto" && record.situacao === "saiu") &&
    record.cadastroStatus === "incompleto";
  const color =
    record.kind === "piloto" && record.situacao !== "saiu" && record.serie
      ? seriesColor[record.serie]
      : "#6F788B";
  return (
    <button
      type="button"
      onClick={onSelect}
      className="pilot-list-row grid min-h-[72px] w-full grid-cols-[5px_68px_minmax(0,1fr)_auto] items-stretch border-b border-border bg-[#131722] text-left outline-none transition-colors last:border-b-0 hover:bg-[#19202A] focus-visible:relative focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#60A5FA] motion-reduce:transition-none md:grid-cols-[5px_84px_minmax(0,1fr)_auto]"
    >
      <span style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="font-data flex items-center px-3 text-xs text-muted-foreground md:text-sm">
        {record.id}
      </span>
      <span className="min-w-0 self-center py-3 pr-3">
        <span className="font-display block truncate text-2xl font-bold uppercase leading-none md:text-3xl">
          {record.apelido}
        </span>
        <span className="font-data mt-1 block truncate text-xs text-muted-foreground md:text-sm">
          {record.simgrid || record.nomeCompleto || "Pendente"}
        </span>
        {record.kind === "piloto" && record.situacao === "saiu" && (
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Saída: {record.saidaEm ? formatShortDate(record.saidaEm) : "Pendente"}
            {" · "}Motivo: {record.motivoSaida || "Pendente"}
            {" · "}Volta: {record.previsaoVolta || "Pendente"}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end justify-center gap-1 py-2 pr-3">
        {record.kind === "fila" && <StatusLabel tone="neutral">Fila</StatusLabel>}
        {record.kind === "formulario" && (
          <StatusLabel tone="warning">Aguardando aprovação</StatusLabel>
        )}
        {record.kind === "piloto" &&
          record.situacao !== "saiu" &&
          record.inscricaoPendente && (
          <StatusLabel tone="warning"><span className="md:hidden">Pendente</span><span className="hidden md:inline">Inscrição pendente</span></StatusLabel>
          )}
        {record.kind === "piloto" && record.situacao === "saiu" && (
          <StatusLabel tone="danger">Ex-piloto</StatusLabel>
        )}
        {record.kind === "piloto" && record.situacao === "suplente" && (
          <StatusLabel tone="neutral">Suplente</StatusLabel>
        )}
        {record.kind === "piloto" && record.situacao === "inativo" && (
          <StatusLabel tone="neutral">Piloto inativo</StatusLabel>
        )}
        {record.kind !== "formulario" && record.arquivadoEm && (
          <StatusLabel tone="neutral">Arquivado</StatusLabel>
        )}
        {incomplete && <StatusLabel tone="danger">Cadastro incompleto</StatusLabel>}
      </span>
    </button>
  );
}

function StatusLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "warning" | "danger" | "neutral";
}) {
  return (
    <span
      className={cn(
        "border px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-wide",
        tone === "warning" && "border-[#60A5FA] text-[#60A5FA]",
        tone === "danger" && "border-[#E8604C] text-[#FF8A78]",
        tone === "neutral" && "border-[#515A69] text-[#C4CBD8]",
      )}
    >
      {children}
    </span>
  );
}

type MembershipStatus = "ativo" | "suplente" | "inativo" | "saiu";

function PilotMembershipPanel({
  pilotId,
  pilotName,
  whatsapp,
  competitions,
  divisions,
  enrollments,
  editable,
  startedSeasonIds,
  onMembershipChange,
  onMembershipRemove,
}: {
  pilotId: string;
  pilotName: string;
  whatsapp: string | null;
  competitions: RaceCompetition[];
  divisions: RaceDivision[];
  enrollments: RacePilot[];
  editable: boolean;
  startedSeasonIds: Set<string>;
  onMembershipChange: (
    pilotId: string,
    temporadaId: string,
    serie: string,
    situacao: MembershipStatus,
  ) => void;
  onMembershipRemove: (pilotId: string, temporadaId: string) => void;
}) {
  const [memberships, setMemberships] = useState(enrollments);
  const availableCompetitions = competitions.filter(
    (competition) => competition.status === "ativa",
  );
  const firstAvailable =
    availableCompetitions.find(
      (competition) =>
        !memberships.some((item) => item.temporadaId === competition.id),
    ) ?? availableCompetitions[0];
  const [newCompetition, setNewCompetition] = useState(firstAvailable?.id ?? "");
  const [newDivision, setNewDivision] = useState(
    divisions.find(
      (division) =>
        division.temporadaId === firstAvailable?.id && division.status === "ativa",
    )?.codigo ?? "",
  );
  const [newStatus, setNewStatus] = useState<MembershipStatus>("ativo");
  const [message, setMessage] = useState("");
  const [removingSeason,setRemovingSeason]=useState<string|null>(null);
  const [invite, setInvite] = useState<{ message: string; url: string } | null>(
    null,
  );

  const active = memberships.filter((item) => {
    const competition = competitions.find(
      (entry) => entry.id === item.temporadaId,
    );
    const division = divisions.find(
      (entry) =>
        entry.temporadaId === item.temporadaId && entry.codigo === item.serie,
    );
    return (
      competition?.status === "ativa" &&
      (division?.status ?? "ativa") === "ativa" &&
      item.situacao !== "saiu"
    );
  });
  const history = memberships.filter((item) => !active.includes(item));

  async function save(
    temporadaId: string,
    serie: string,
    situacao: MembershipStatus,
    previousSerie?: string,
  ) {
    setMessage("Salvando…");
    setInvite(null);
    const response = await fetch(`/central/api/pilotos/${pilotId}/inscricoes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ temporadaId, serie, situacao }),
    });
    const result = (await response.json()) as {
      error?: string;
      divisionName?: string;
      whatsappGroupUrl?: string | null;
    };
    if (!response.ok) {
      setMessage(result.error ?? "Não foi possível salvar.");
      return false;
    }

    setMemberships((current) => {
      const existing = current.find((item) => item.temporadaId === temporadaId);
      const updated: RacePilot = {
        id: pilotId,
        apelido: pilotName,
        simgrid: existing?.simgrid ?? null,
        temporadaId,
        serie,
        situacao,
        pilotoArquivado: false,
      };
      return existing
        ? current.map((item) =>
            item.temporadaId === temporadaId ? updated : item,
          )
        : [...current, updated];
    });
    onMembershipChange(pilotId, temporadaId, serie, situacao);
    setMessage("Participação salva.");

    const changedDivision = previousSerie === undefined || previousSerie !== serie;
    const canInvite = situacao === "ativo" || situacao === "suplente";
    if (changedDivision && canInvite && result.whatsappGroupUrl && whatsapp) {
      const competitionName =
        competitions.find((competition) => competition.id === temporadaId)?.nome ??
        temporadaId;
      const divisionName = result.divisionName ?? serie;
      const text = `Olá, ${pilotName}! Sua participação foi atualizada para ${divisionName} na ${competitionName}. Este é o grupo da sua divisão: ${result.whatsappGroupUrl}`;
      const url = makeWhatsappUrl(whatsapp, text);
      if (url) setInvite({ message: text, url });
    }
    return true;
  }

  async function removeMembership(temporadaId:string){
    setRemovingSeason(temporadaId);setMessage("Tirando piloto da temporada…");setInvite(null);
    const response=await fetch(`/central/api/pilotos/${pilotId}/inscricoes`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({temporadaId})});
    const result=await response.json() as {error?:string};setRemovingSeason(null);
    if(!response.ok){setMessage(result.error??"Não foi possível tirar o piloto da temporada.");return false;}
    setMemberships((current)=>current.filter((item)=>item.temporadaId!==temporadaId));
    onMembershipRemove(pilotId,temporadaId);setMessage("Piloto retirado da temporada. O cadastro geral foi preservado.");return true;
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-xl font-bold uppercase tracking-wide">
          Participações atuais
        </p>
        {active.length === 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            Nenhuma participação ativa.
          </p>
        )}
        <div className="mt-2 space-y-3">
          {active.map((membership) => {
            const competition = competitions.find(
              (entry) => entry.id === membership.temporadaId,
            );
            const options = divisions.filter(
              (division) =>
                division.temporadaId === membership.temporadaId &&
                division.status === "ativa",
            );
            return (
              <div
                key={membership.temporadaId}
                className="border border-border bg-[#10141B] p-3"
              >
                <p className="mb-3 font-semibold">
                  {competition?.nome ?? membership.temporadaId}
                </p>
                <div className="space-y-3">
                  <NativeSelectField
                    label="Série ou divisão"
                    value={membership.serie}
                    options={options.map((division) => ({
                      value: division.codigo,
                      label: division.nome,
                    }))}
                    editable={editable}
                    onSave={(serie) =>
                      save(
                        membership.temporadaId,
                        serie,
                        (membership.situacao ?? "ativo") as MembershipStatus,
                        membership.serie,
                      )
                    }
                  />
                  <NativeSelectField
                    label="Situação dentro da série"
                    value={membership.situacao ?? "ativo"}
                    options={[
                      { value: "ativo", label: "Piloto ativo" },
                      { value: "suplente", label: "Suplente" },
                      { value: "inativo", label: "Piloto inativo" },
                      { value: "saiu", label: "Não vai participar" },
                    ]}
                    editable={editable}
                    onSave={(status) =>
                      save(
                        membership.temporadaId,
                        membership.serie,
                        status as MembershipStatus,
                        membership.serie,
                      )
                    }
                  />
                  {editable&&!startedSeasonIds.has(membership.temporadaId)&&<AlertDialog><AlertDialogTrigger asChild><button type="button" className="min-h-11 w-full border border-[#E8604C] px-3 text-sm font-bold text-[#FF8A78] outline-none hover:bg-[#351D1C] focus-visible:ring-2 focus-visible:ring-[#E8604C]">Tirar da temporada</button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Tirar {pilotName} desta temporada?</AlertDialogTitle><AlertDialogDescription>O piloto sairá da série {membership.serie} em {competition?.nome??membership.temporadaId}. O cadastro geral e os demais históricos não serão apagados.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={removingSeason===membership.temporadaId} onClick={()=>void removeMembership(membership.temporadaId)} className="bg-[#E8604C] text-white hover:bg-[#F07160]">{removingSeason===membership.temporadaId?"Tirando…":"Tirar da temporada"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
                  {editable&&startedSeasonIds.has(membership.temporadaId)&&<p className="text-xs leading-5 text-muted-foreground">A temporada já começou. Para manter o histórico, altere a situação para “Não vai participar”.</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {invite && (
        <div className="border-l-2 border-[#00E676] bg-[#0D2A1B] p-3">
          <p className="font-semibold text-[#73FFB0]">Convite da divisão pronto</p>
          <p className="mt-1 text-sm leading-6 text-[#B9E7CE]">
            A mensagem já inclui o grupo correto. Revise no WhatsApp antes de
            enviar.
          </p>
          <a
            href={invite.url}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex min-h-11 items-center justify-center gap-2 bg-[#00E676] px-3 font-bold text-[#06120C] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            Enviar grupo no WhatsApp
          </a>
        </div>
      )}

      {editable && availableCompetitions.length > 0 && (
        <details className="border border-border bg-[#10141B]">
          <summary className="flex min-h-11 cursor-pointer list-none items-center px-3 font-semibold text-[#60A5FA]">
            Adicionar a outra competição
          </summary>
          <div className="space-y-3 border-t border-border p-3">
            <NativeSelectField
              label="Competição"
              value={newCompetition}
              options={availableCompetitions.map((competition) => ({
                value: competition.id,
                label: competition.nome,
              }))}
              editable
              onSave={async (value) => {
                setNewCompetition(value);
                setNewDivision(
                  divisions.find(
                    (division) =>
                      division.temporadaId === value && division.status === "ativa",
                  )?.codigo ?? "",
                );
                return true;
              }}
            />
            <NativeSelectField
              label="Série ou divisão"
              value={newDivision}
              options={divisions
                .filter(
                  (division) =>
                    division.temporadaId === newCompetition &&
                    division.status === "ativa",
                )
                .map((division) => ({
                  value: division.codigo,
                  label: division.nome,
                }))}
              editable
              onSave={async (value) => {
                setNewDivision(value);
                return true;
              }}
            />
            <NativeSelectField
              label="Situação"
              value={newStatus}
              options={[
                { value: "ativo", label: "Piloto ativo" },
                { value: "suplente", label: "Suplente" },
                { value: "inativo", label: "Piloto inativo" },
              ]}
              editable
              onSave={async (value) => {
                setNewStatus(value as MembershipStatus);
                return true;
              }}
            />
            <button
              type="button"
              disabled={!newCompetition || !newDivision}
              onClick={() => save(newCompetition, newDivision, newStatus)}
              className="min-h-11 w-full bg-[#60A5FA] px-3 font-bold text-[#0A0C10] disabled:bg-[#3B3F46] disabled:text-[#8A92A6]"
            >
              Adicionar ao grid
            </button>
          </div>
        </details>
      )}

      {history.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="font-display text-xl font-bold uppercase tracking-wide">
            Histórico
          </p>
          <div className="mt-2 space-y-2">
            {history.map((membership) => {
              const competition = competitions.find(
                (entry) => entry.id === membership.temporadaId,
              );
              const division = divisions.find(
                (entry) =>
                  entry.temporadaId === membership.temporadaId &&
                  entry.codigo === membership.serie,
              );
              const status =
                division?.status !== "ativa"
                  ? division?.status
                  : competition?.status !== "ativa"
                    ? competition?.status
                    : "encerrada";
              return (
                <div
                  key={membership.temporadaId}
                  className="border-l-2 border-[#8A92A6] bg-[#10141B] p-3"
                >
                  <p className="font-semibold">
                    {competition?.nome ?? membership.temporadaId} ·{" "}
                    {division?.nome ?? membership.serie}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status}
                    {division?.motivoArquivamento
                      ? ` · ${division.motivoArquivamento}`
                      : competition?.motivoArquivamento
                        ? ` · ${competition.motivoArquivamento}`
                        : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {message}
      </p>
    </div>
  );
}

function PersonArchiveControls({record,editable}:{record:PilotListItem|QueueListItem;editable:boolean}){
  const [reason,setReason]=useState(record.motivoArquivamento??"");
  const [message,setMessage]=useState("");
  async function run(action:"arquivar"|"reativar"|"apagar"){
    if(action==="apagar"&&!window.confirm(`Apagar definitivamente o cadastro de “${record.apelido}”? Esta ação não pode ser desfeita.`))return;
    setMessage("Salvando…");
    const resource=record.kind==="piloto"?"pilotos":"fila";
    const response=await fetch(`/central/api/${resource}/${record.id}/administracao`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action,motivo:reason})});
    const result=await response.json() as {error?:string};
    if(!response.ok){setMessage(result.error??"Não foi possível concluir.");return;}
    window.location.reload();
  }
  if(!editable)return record.arquivadoEm?<div className="border-l-2 border-[#8A92A6] bg-[#10141B] p-3 text-sm text-muted-foreground">Arquivado em {formatDateTime(record.arquivadoEm)}{record.motivoArquivamento?` · ${record.motivoArquivamento}`:""}</div>:null;
  return <div className="border-t border-border pt-4"><p className="font-display text-xl font-bold uppercase tracking-wide">Arquivamento e exclusão</p>{record.arquivadoEm?<><div className="mt-2 border-l-2 border-[#8A92A6] bg-[#10141B] p-3 text-sm text-muted-foreground">Arquivado em {formatDateTime(record.arquivadoEm)}{record.motivoArquivamento?` · ${record.motivoArquivamento}`:""}</div><button type="button" onClick={()=>run("reativar")} className="mt-3 min-h-11 w-full border border-[#60A5FA] px-3 font-bold text-[#60A5FA]">Reativar cadastro</button></>:<><label className="mt-3 block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground">Motivo para arquivar</span><textarea value={reason} onChange={event=>setReason(event.target.value)} className="min-h-20 w-full border border-border bg-[#0D1118] p-3"/></label><button type="button" disabled={!reason.trim()} onClick={()=>run("arquivar")} className="mt-2 min-h-11 w-full border border-[#60A5FA] px-3 font-bold text-[#60A5FA] disabled:border-border disabled:text-muted-foreground">Arquivar cadastro</button></>}<button type="button" onClick={()=>run("apagar")} className="mt-3 min-h-11 w-full border border-[#E8604C] px-3 font-bold text-[#FF8A78]">Apagar definitivamente</button><p className="mt-2 text-xs leading-5 text-muted-foreground">Cadastros de piloto com corrida ou pagamento não podem ser apagados; nesses casos, arquive para preservar o histórico.</p><p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{message}</p></div>
}

function RecordSheet({
  record,
  raceData,
  editable,
  isAdmin,
  campeonatoIniciado,
  cashEntries,
  saveStatus,
  onSave,
  onRegisterPayment,
  onSetPaymentExemption,
  onDeletePayment,
  onPromote,
  onMembershipChange,
  onMembershipRemove,
}: {
  record: PilotListItem | QueueListItem;
  raceData: {
    competicoes: RaceCompetition[];
    divisoes: RaceDivision[];
    pilotos: RacePilot[];
    resultados: RaceResult[];
  };
  editable: boolean;
  isAdmin: boolean;
  campeonatoIniciado: boolean;
  cashEntries: CashEntry[];
  saveStatus: {
    message: string;
    tone: "saving" | "success" | "error";
  } | null;
  onSave: (field: string, value: unknown) => Promise<boolean>;
  onRegisterPayment: (data: string, valor: number) => Promise<boolean>;
  onSetPaymentExemption: (isento: boolean) => Promise<boolean>;
  onDeletePayment: (entry: CashEntry) => Promise<boolean>;
  onPromote: (
    serie: Serie,
    situacao: "ativo" | "suplente",
  ) => Promise<boolean>;
  onMembershipChange: (
    pilotId: string,
    temporadaId: string,
    serie: string,
    situacao: MembershipStatus,
  ) => void;
  onMembershipRemove: (pilotId: string, temporadaId: string) => void;
}) {
  const whatsappUrl = makeWhatsappUrl(record.whatsapp);

  return (
    <>
      <SheetHeader className="relative border-b border-border bg-[#0D1016] p-5 pr-16">
        <div className="flex items-center gap-2">
          <span className="font-data text-xs text-muted-foreground">{record.id}</span>
          <StatusLabel tone="neutral">
            {record.kind === "piloto"
              ? record.situacao === "saiu"
                ? "Ex-piloto"
                : record.serie
                  ? `Série ${record.serie}`
                  : "Sem divisão atual"
              : "Fila"}
          </StatusLabel>
          {saveStatus && (
            <span
              className={cn(
                "ml-auto text-xs",
                saveStatus.tone === "error"
                  ? "text-[#FF8A78]"
                  : "text-[#00E676]",
              )}
              aria-live="polite"
            >
              {saveStatus.message}
            </span>
          )}
        </div>
        <SheetTitle className="font-display mt-2 text-4xl font-bold uppercase leading-none text-foreground">
          {record.apelido}
        </SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          {record.nomeCompleto || "Nome completo pendente"}
        </SheetDescription>
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 size-11 rounded-none text-muted-foreground hover:bg-[#1B222D] hover:text-foreground focus-visible:ring-[#60A5FA]"
            aria-label="Fechar ficha"
          >
            <X className="size-5" />
          </Button>
        </SheetClose>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 overflow-y-auto pb-8">
        {record.kind === "piloto" ? (
          <>
            <PanelSection title="Campeonato" icon={Trophy}>
              {record.serie || cashEntries.some((entry)=>entry.pilotoId===record.id&&entry.temporadaId==="2026") ? (
                <PaymentRegistration
                  totalPago={record.totalPago}
                  isentoPagamento={record.isentoPagamento}
                  inscricaoPendente={record.inscricaoPendente}
                  editable={isAdmin}
                  hasEnrollment={Boolean(record.serie)}
                  entries={cashEntries.filter((entry)=>entry.pilotoId===record.id&&entry.temporadaId==="2026")}
                  onRegister={onRegisterPayment}
                  onSetExemption={onSetPaymentExemption}
                  onDelete={onDeletePayment}
                />
              ) : (
                <div className="border-l-2 border-[#8A92A6] bg-[#131722] p-3">
                  <p className="font-semibold">Sem inscrição na temporada atual</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    O piloto continua no cadastro geral e pode ser incluído em uma
                    competição pela área de participações.
                  </p>
                </div>
              )}
              {!campeonatoIniciado ? (
                <div className="border-l-2 border-[#60A5FA] bg-[#131722] p-3">
                  <p className="font-semibold">O campeonato ainda não começou.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Posição, pontos e faltas aparecerão depois do primeiro resultado.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  A classificação será apresentada na etapa própria do sistema.
                </p>
              )}
              <PilotMembershipPanel
                pilotId={record.id}
                pilotName={record.apelido}
                whatsapp={record.whatsapp}
                competitions={raceData.competicoes}
                divisions={raceData.divisoes}
                enrollments={raceData.pilotos.filter((pilot) => pilot.id === record.id)}
                editable={editable && isAdmin}
                startedSeasonIds={new Set(raceData.resultados.map((result)=>result.temporadaId))}
                onMembershipChange={onMembershipChange}
                onMembershipRemove={onMembershipRemove}
              />
              {record.situacao === "saiu" && (
                <div className="border-t border-border pt-4">
                  <p className="font-display text-xl font-bold uppercase tracking-wide">
                    Histórico da saída
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Preencha somente as informações confirmadas. Campos vazios
                    continuarão marcados como pendentes.
                  </p>
                  <div className="mt-3 space-y-3">
                    <EditableField
                      label="Data da saída"
                      field="saidaEm"
                      value={record.saidaEm}
                      editable={editable && isAdmin}
                      inputType="date"
                      mono
                      onSave={onSave}
                    />
                    <EditableField
                      label="Motivo da saída"
                      field="motivoSaida"
                      value={record.motivoSaida}
                      editable={editable && isAdmin}
                      multiline
                      onSave={onSave}
                    />
                    <EditableField
                      label="Previsão de volta"
                      field="previsaoVolta"
                      value={record.previsaoVolta}
                      editable={editable && isAdmin}
                      onSave={onSave}
                    />
                  </div>
                </div>
              )}
            </PanelSection>

            <PanelSection title="Contato" icon={MessageCircle}>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 border border-[#00E676] bg-[#0D2A1B] px-4 text-sm font-bold text-[#73FFB0] outline-none hover:bg-[#123822] focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                >
                  <MessageCircle className="size-5" aria-hidden="true" />
                  {record.whatsapp}
                </a>
              )}
              <EditableField
                label="WhatsApp"
                field="whatsapp"
                value={record.whatsapp}
                editable={editable}
                mono
                onSave={onSave}
              />
              <EditableField label="E-mail" field="email" value={record.email} editable={editable} onSave={onSave} />
              <div className="grid grid-cols-[1fr_84px] gap-2">
                <EditableField label="Cidade" field="cidade" value={record.cidade} editable={editable} onSave={onSave} />
                <EditableField label="UF" field="uf" value={record.uf} editable={editable} onSave={onSave} />
              </div>
            </PanelSection>

            <PanelSection title="Identificação" icon={UserRound}>
              <EditableField label="Apelido de narração" field="apelido" value={record.apelido} editable={editable} required onSave={onSave} />
              <EditableField label="Nome completo" field="nomeCompleto" value={record.nomeCompleto} editable={editable} onSave={onSave} />
              <EditableField label="PSN" field="psn" value={record.psn} editable={editable} mono onSave={onSave} />
              <ReadOnlyField label="Rua" value={record.rua ?? null} />
              <ReadOnlyField label="Número" value={record.numero ?? null} />
              <ReadOnlyField label="Bairro" value={record.bairro ?? null} />
              <ReadOnlyField label="CEP" value={record.cep ?? null} />
              <ReadOnlyField label="Complemento" value={record.complemento ?? null} />
              <ReadOnlyField label="Classificação GT7" value={record.classificacao_gt7 ?? null} />
              <EditableField label="SimGrid" field="simgrid" value={record.simgrid} editable={editable} mono onSave={onSave} />
              <EditableField label="Link do SimGrid" field="simgridUrl" value={record.simgridUrl} editable={editable} mono onSave={onSave} />
              <EditableField label="Data de nascimento" field="dataNascimento" value={record.dataNascimento} editable={editable} inputType="date" mono onSave={onSave} />
              <EditableField label="Entrada na Speed GT" field="dataEntrada" value={record.dataEntrada} editable={editable && isAdmin} inputType="date" mono onSave={onSave} />
              {record.dataEntrada && <p className="border-l-2 border-[#60A5FA] bg-[#10141B] p-3 text-sm text-muted-foreground">Aniversário na liga: {formatDayMonth(record.dataEntrada)} · entrada em {formatShortDate(record.dataEntrada)}</p>}
            </PanelSection>

            <PanelSection title="Na pista" icon={Flag}>
              <NativeSelectField label="Volante ou controle" value={record.volanteOuControle ?? "pendente"} options={[{value:"pendente",label:"Pendente"},{value:"Volante",label:"Volante"},{value:"Controle",label:"Controle"},{value:"Volante e controle",label:"Volante e controle"}]} editable={editable} onSave={(value)=>onSave("volanteOuControle",value==="pendente"?null:value)} />
              <EditableField label="Perfil de pilotagem" field="perfilPilotagem" value={record.perfilPilotagem} editable={editable} onSave={onSave} />
              <EditableField label="Disponibilidade" field="disponibilidade" value={record.disponibilidade} editable={editable} onSave={onSave} />
              <EditableField label="Carro preferido" field="carroPreferido" value={record.carroPreferido} editable={editable} onSave={onSave} />
              <EditableField label="Pista citada" field="pistaCitada" value={record.pistaCitada} editable={editable} onSave={onSave} />
            </PanelSection>

            <PanelSection title="Para a narração" icon={ClipboardList}>
              <EditableField label="Relações" field="relacoes" value={record.relacoes} editable={editable} multiline onSave={onSave} />
              <EditableField label="Curiosidade" field="curiosidade" value={record.curiosidade} editable={editable} multiline onSave={onSave} />
            </PanelSection>

            <PanelSection title="Administração" icon={UserRound}>
              <EditableField label="Observações administrativas" field="observacoesAdm" value={record.observacoesAdm} editable={editable} multiline onSave={onSave} />
              <NativeSelectField
                label="Registro da pessoa"
                value={record.ativo === null ? "pendente" : record.ativo ? "ativo" : "inativo"}
                options={[
                  { value: "pendente", label: "Sem definição" },
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ]}
                editable={editable}
                onSave={(value) => onSave("ativo", value === "pendente" ? null : value === "ativo")}
              />
              <NativeSelectField
                label="Controle do cadastro"
                value={record.cadastroStatus ?? "sem_marcacao"}
                options={[
                  { value: "sem_marcacao", label: "Sem marcação" },
                  { value: "completo", label: "Cadastro completo" },
                  { value: "incompleto", label: "Cadastro incompleto" },
                ]}
                editable={editable}
                onSave={(value) =>
                  onSave(
                    "cadastroStatus",
                    value === "sem_marcacao" ? null : value,
                  )
                }
              />
              <PersonArchiveControls record={record} editable={editable && isAdmin} />
            </PanelSection>
          </>
        ) : (
          <>
            <PanelSection title="Entrada na série" icon={UserPlus}>
              <PromotionPanel editable={editable} ready={record.prontoParaSerie===true} onPromote={onPromote} />
            </PanelSection>
            <PanelSection title="Contato" icon={MessageCircle}>
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-12 items-center justify-center gap-2 border border-[#00E676] bg-[#0D2A1B] px-4 text-sm font-bold text-[#73FFB0] outline-none hover:bg-[#123822] focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                >
                  <MessageCircle className="size-5" aria-hidden="true" />
                  {record.whatsapp}
                </a>
              )}
              <EditableField label="WhatsApp" field="whatsapp" value={record.whatsapp} editable={editable} mono onSave={onSave} />
              <EditableField label="E-mail" field="email" value={record.email} editable={editable} onSave={onSave} />
              <div className="grid grid-cols-[1fr_84px] gap-2">
                <EditableField label="Cidade" field="cidade" value={record.cidade} editable={editable} onSave={onSave} />
                <EditableField label="UF" field="uf" value={record.uf} editable={editable} onSave={onSave} />
              </div>
            </PanelSection>
            <PanelSection title="Identificação" icon={UserRound}>
              <EditableField label="Apelido de narração" field="apelido" value={record.apelido} editable={editable} required onSave={onSave} />
              <EditableField label="Nome completo" field="nomeCompleto" value={record.nomeCompleto} editable={editable} onSave={onSave} />
              <EditableField label="PSN" field="psn" value={record.psn} editable={editable} mono onSave={onSave} />
              <ReadOnlyField label="Rua" value={record.rua ?? null} />
              <ReadOnlyField label="Número" value={record.numero ?? null} />
              <ReadOnlyField label="Bairro" value={record.bairro ?? null} />
              <ReadOnlyField label="CEP" value={record.cep ?? null} />
              <ReadOnlyField label="Complemento" value={record.complemento ?? null} />
              <ReadOnlyField label="Classificação GT7" value={record.classificacao_gt7 ?? null} />
              <EditableField label="SimGrid" field="simgrid" value={record.simgrid} editable={editable} mono onSave={onSave} />
              <EditableField label="Link do SimGrid" field="simgridUrl" value={record.simgridUrl} editable={editable} mono onSave={onSave} />
              <EditableField label="Data de nascimento" field="dataNascimento" value={record.dataNascimento} editable={editable} inputType="date" mono onSave={onSave} />
              <EditableField label="Entrada na Speed GT" field="dataEntrada" value={record.dataEntrada} editable={editable} inputType="date" mono onSave={onSave} />
              {record.dataEntrada && <p className="border-l-2 border-[#60A5FA] bg-[#10141B] p-3 text-sm text-muted-foreground">Aniversário na liga: {formatDayMonth(record.dataEntrada)} · entrada em {formatShortDate(record.dataEntrada)}</p>}
            </PanelSection>
            <PanelSection title="Na pista" icon={Flag}>
              <NativeSelectField label="Volante ou controle" value={record.volanteOuControle ?? "pendente"} options={[{value:"pendente",label:"Pendente"},{value:"Volante",label:"Volante"},{value:"Controle",label:"Controle"},{value:"Volante e controle",label:"Volante e controle"}]} editable={editable} onSave={(value)=>onSave("volanteOuControle",value==="pendente"?null:value)} />
              <EditableField label="Perfil de pilotagem" field="perfilPilotagem" value={record.perfilPilotagem} editable={editable} onSave={onSave} />
              <EditableField label="Disponibilidade" field="disponibilidade" value={record.disponibilidade} editable={editable} onSave={onSave} />
              <EditableField label="Carro preferido" field="carroPreferido" value={record.carroPreferido} editable={editable} onSave={onSave} />
              <EditableField label="Pista citada" field="pistaCitada" value={record.pistaCitada} editable={editable} onSave={onSave} />
            </PanelSection>
            <PanelSection title="Para a narração" icon={ClipboardList}>
              <EditableField label="Relações" field="relacoes" value={record.relacoes} editable={editable} multiline onSave={onSave} />
              <EditableField label="Curiosidade" field="curiosidade" value={record.curiosidade} editable={editable} multiline onSave={onSave} />
            </PanelSection>
            <PanelSection title="Fila" icon={ListOrdered}>
              <p className="text-xs text-muted-foreground">A participação em eventos será organizada pela administração.</p>
              <EditableField label="Conduta" field="conduta" value={record.conduta} editable={editable} multiline onSave={onSave} />
              <NativeSelectField
                label="Pronto para série ou suplência"
                value={record.prontoParaSerie === null ? "pendente" : record.prontoParaSerie ? "sim" : "nao"}
                options={[
                  { value: "pendente", label: "Sem definição" },
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                ]}
                editable={editable}
                onSave={(value) => onSave("prontoParaSerie", value === "pendente" ? null : value === "sim")}
              />
            </PanelSection>
            <PanelSection title="Administração" icon={UserRound}>
              <EditableField label="Observações administrativas" field="observacoesAdm" value={record.observacoesAdm} editable={editable} multiline onSave={onSave} />
              <NativeSelectField
                label="Registro da pessoa"
                value={record.ativo === null ? "pendente" : record.ativo ? "ativo" : "inativo"}
                options={[
                  { value: "pendente", label: "Sem definição" },
                  { value: "ativo", label: "Ativo" },
                  { value: "inativo", label: "Inativo" },
                ]}
                editable={editable}
                onSave={(value) => onSave("ativo", value === "pendente" ? null : value === "ativo")}
              />
              <NativeSelectField
                label="Controle do cadastro"
                value={record.cadastroStatus ?? "sem_marcacao"}
                options={[
                  { value: "sem_marcacao", label: "Sem marcação" },
                  { value: "completo", label: "Cadastro completo" },
                  { value: "incompleto", label: "Cadastro incompleto" },
                ]}
                editable={editable}
                onSave={(value) => onSave("cadastroStatus", value === "sem_marcacao" ? null : value)}
              />
              <PersonArchiveControls record={record} editable={editable && isAdmin} />
            </PanelSection>
          </>
        )}
      </div>
    </>
  );
}

function PromotionPanel({
  ready,
  editable,
  onPromote,
}: {
  ready: boolean;
  editable: boolean;
  onPromote: (
    serie: Serie,
    situacao: "ativo" | "suplente",
  ) => Promise<boolean>;
}) {
  const [serie, setSerie] = useState<Serie | "">("");
  const [situacao, setSituacao] = useState<"ativo" | "suplente">("ativo");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!serie) return;
    setSubmitting(true);
    await onPromote(serie, situacao);
    setSubmitting(false);
  }

  return (
    <div className="border-l-2 border-[#60A5FA] bg-[#131722] p-3">
      <p className="font-semibold">Promover para o campeonato</p>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Os dados desta ficha serão mantidos. A pessoa sai da fila e recebe um
        novo código de piloto.
      </p>
      {!ready&&<p className="mt-2 text-sm text-[#60A5FA]">Marque a avaliação como pronta para série ou suplência antes de promover.</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Série
          </span>
          <select
            value={serie}
            disabled={!editable || submitting}
            onChange={(event) => setSerie(event.target.value as Serie)}
            className="h-11 w-full border border-border bg-[#0D1118] px-3 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
          >
            <option value="">Escolha a série</option>
            <option value="A">Série A</option>
            <option value="B">Série B</option>
            <option value="C">Série C</option>
          </select>
        </label>
        <label>
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Entrada
          </span>
          <select
            value={situacao}
            disabled={!editable || submitting}
            onChange={(event) =>
              setSituacao(event.target.value as "ativo" | "suplente")
            }
            className="h-11 w-full border border-border bg-[#0D1118] px-3 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
          >
            <option value="ativo">Piloto ativo</option>
            <option value="suplente">Suplente</option>
          </select>
        </label>
      </div>
      <button
        type="button"
        disabled={!editable || !ready || !serie || submitting}
        onClick={submit}
        className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 bg-[#60A5FA] px-3 text-sm font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131722] disabled:opacity-50"
      >
        <UserPlus className="size-4" aria-hidden="true" />
        {submitting ? "Promovendo…" : "Promover agora"}
      </button>
      {!editable && (
        <p className="mt-2 text-xs text-muted-foreground">
          Somente o administrador pode promover pessoas da fila.
        </p>
      )}
    </div>
  );
}

function PendingFormSheet({
  form,
  people,
  editable,
  onResolved,
}: {
  form: PendingFormListItem;
  people: Array<PilotListItem | QueueListItem>;
  editable: boolean;
  onResolved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [approved, setApproved] = useState(false);
  const [inviteMessage, setInviteMessage] = useState(
    `Olá, ${form.nomeCompleto}! Seu cadastro na Speed GT Brasil foi aprovado. Seja bem-vindo! Este é o grupo geral da liga: ${GENERAL_WHATSAPP_GROUP_URL}`,
  );
  const automaticMatches = useMemo(
    () =>
      people
        .map((person) => ({
          person,
          score: registrationMatchScore(form, person),
        }))
        .filter((candidate) => candidate.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((candidate) => candidate.person),
    [form, people],
  );
  const matches = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return automaticMatches;
    return people
      .filter((person) => searchableText(person).includes(normalizedQuery))
      .slice(0, 8);
  }, [automaticMatches, people, query]);
  const selectedPerson = people.find(
    (person) => `${person.kind}:${person.id}` === selectedKey,
  );

  async function resolve(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/central/api/formularios/${form.formularioId}/aprovar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível concluir.");
      if (payload.action === "descartar") {
        onResolved();
        return;
      }
      setApproved(true);
      setSubmitting(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erro ao concluir.");
      setSubmitting(false);
    }
  }

  if (approved) {
    const whatsappUrl = makeWhatsappUrl(form.whatsapp, inviteMessage);
    return (
      <>
        <SheetHeader className="relative border-b border-border bg-[#0D1016] p-5 pr-16">
          <StatusLabel tone="neutral">Cadastro aprovado</StatusLabel>
          <SheetTitle className="font-display mt-3 text-4xl font-bold uppercase leading-none text-foreground">
            Saudação pronta
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Revise a mensagem antes de abrir o WhatsApp.
          </SheetDescription>
          <button
            type="button"
            onClick={onResolved}
            className="absolute right-3 top-3 flex size-11 items-center justify-center text-muted-foreground outline-none hover:bg-[#1B222D] hover:text-foreground focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
            aria-label="Concluir e fechar"
          >
            <X className="size-5" />
          </button>
        </SheetHeader>
        <div className="space-y-4 p-5">
          <div className="border-l-2 border-[#00E676] bg-[#0D2A1B] p-3">
            <p className="font-semibold text-[#73FFB0]">
              As informações foram salvas
            </p>
            <p className="mt-1 text-sm leading-6 text-[#B9E7CE]">
              O envio não é automático. O botão abaixo abre a conversa com a
              mensagem preenchida para você confirmar.
            </p>
          </div>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Mensagem de boas-vindas
            </span>
            <textarea
              value={inviteMessage}
              onChange={(event) => setInviteMessage(event.target.value)}
              className="min-h-36 w-full border border-border bg-[#0D1118] p-3 leading-6 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
            />
          </label>
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-12 items-center justify-center gap-2 bg-[#00E676] px-4 font-bold text-[#06120C] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Abrir mensagem no WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={onResolved}
            className="min-h-11 w-full border border-border px-3 font-semibold text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
          >
            Concluir sem enviar agora
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader className="relative border-b border-border bg-[#0D1016] p-5 pr-16">
        <div className="flex items-center gap-2">
          <span className="font-data text-xs text-muted-foreground">
            FORM-{form.formularioId}
          </span>
          <StatusLabel tone="warning">Aguardando aprovação</StatusLabel>
        </div>
        <SheetTitle className="font-display mt-2 text-4xl font-bold uppercase leading-none text-foreground">
          {form.nomeCompleto}
        </SheetTitle>
        <SheetDescription className="text-sm text-muted-foreground">
          Recebido em {formatDateTime(form.criadoEm)}
        </SheetDescription>
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3 size-11 rounded-none text-muted-foreground hover:bg-[#1B222D] hover:text-foreground focus-visible:ring-[#60A5FA]"
            aria-label="Fechar formulário"
          >
            <X className="size-5" />
          </Button>
        </SheetClose>
      </SheetHeader>

      <div className="scrollbar-thin flex-1 overflow-y-auto pb-8">
        <PanelSection title="Dados enviados" icon={ClipboardCheck}>
          <ReadOnlyField label="Nome completo" value={form.nomeCompleto} />
          <ReadOnlyField label="WhatsApp" value={form.whatsapp} mono />
          <ReadOnlyField label="E-mail" value={form.email} />
          <div className="grid grid-cols-[1fr_84px] gap-2">
            <ReadOnlyField label="Cidade" value={form.cidade} />
            <ReadOnlyField label="UF" value={form.uf} />
          </div>
          <ReadOnlyField label="Rua" value={form.rua ?? null} />
          <ReadOnlyField label="Número" value={form.numero ?? null} />
          <ReadOnlyField label="Bairro" value={form.bairro ?? null} />
          <ReadOnlyField label="CEP" value={form.cep ?? null} />
          <ReadOnlyField label="Complemento" value={form.complemento ?? null} />
          <ReadOnlyField label="Classificação GT7" value={form.classificacao_gt7 ?? null} />
          <ReadOnlyField label="PSN" value={form.psn} mono />
        </PanelSection>

        <PanelSection title="Conferência" icon={Search}>
          {editable ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Mescle com a pessoa certa para atualizar o cadastro sem criar
                duplicidade. Somente campos preenchidos neste formulário serão
                atualizados; os demais dados permanecem como estão.
              </p>
              {!query && matches.length > 0 && (
                <p className="border-l-2 border-[#60A5FA] bg-[#272B13] p-3 text-sm text-[#E7EF9B]">
                  Encontramos possíveis cadastros iguais. Confira antes de criar
                  uma pessoa nova.
                </p>
              )}
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Buscar outro cadastro existente
                </span>
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedKey(null);
                  }}
                  placeholder="Nome, apelido, PSN ou telefone"
                  className="h-12 w-full border border-border bg-[#0D1118] px-3 outline-none placeholder:text-[#6F788B] focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
                />
              </label>
              {query && matches.length === 0 && (
                <p className="border-l-2 border-[#60A5FA] bg-[#131722] p-3 text-sm text-muted-foreground">
                  Nenhuma pessoa encontrada. Você pode adicionar este cadastro à fila abaixo.
                </p>
              )}
              {matches.length > 0 && (
                <div className="border-y border-border">
                  {matches.map((person) => {
                    const key = `${person.kind}:${person.id}`;
                    const selected = key === selectedKey;
                    return (
                      <button
                        type="button"
                        key={key}
                        aria-pressed={selected}
                        onClick={() => setSelectedKey(key)}
                        className={cn(
                          "flex min-h-14 w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#60A5FA]",
                          selected ? "bg-[#272B13]" : "bg-[#131722] hover:bg-[#19202A]",
                        )}
                      >
                        <span className="min-w-0">
                          <span className="font-display block truncate text-xl font-bold uppercase">
                            {person.apelido}
                          </span>
                          <span className="font-data block truncate text-xs text-muted-foreground">
                            {person.id} · {person.nomeCompleto || "Nome pendente"}
                          </span>
                        </span>
                        <StatusLabel tone="neutral">
                          {person.kind === "piloto"
                            ? person.serie
                              ? `Série ${person.serie}`
                              : "Sem divisão"
                            : "Fila"}
                        </StatusLabel>
                      </button>
                    );
                  })}
                </div>
              )}
              <button
                type="button"
                disabled={!selectedPerson || submitting}
                onClick={() =>
                  selectedPerson &&
                  resolve({
                    action: "aplicar",
                    targetKind: selectedPerson.kind,
                    targetId: selectedPerson.id,
                  })
                }
                className="min-h-11 w-full border border-[#00E676] px-3 text-sm font-bold text-[#73FFB0] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] disabled:border-border disabled:text-[#6F788B]"
              >
                {selectedPerson
                  ? `Mesclar com ${selectedPerson.apelido}`
                  : "Escolha um cadastro para mesclar"}
              </button>

              <div className="border-t border-border pt-4">
                <p className="font-semibold">Pessoa nova</p>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Informe somente o apelido de narração; os demais dados virão do formulário.
                </p>
                <label className="mt-3 block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Apelido de narração
                  </span>
                  <input
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    className="h-12 w-full border border-border bg-[#0D1118] px-3 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
                  />
                </label>
                <button
                  type="button"
                  disabled={!nickname.trim() || submitting}
                  onClick={() =>
                    resolve({ action: "nova_fila", apelido: nickname.trim() })
                  }
                  className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 bg-[#60A5FA] px-3 text-sm font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#10141B] disabled:opacity-50"
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  Adicionar à fila
                </button>
              </div>

              <div className="border-t border-border pt-4">
                {!confirmDiscard ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setConfirmDiscard(true)}
                    className="min-h-11 w-full border border-[#E8604C] px-3 text-sm font-semibold text-[#FF8A78] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                  >
                    Descartar formulário
                  </button>
                ) : (
                  <div className="border-l-2 border-[#E8604C] bg-[#351D1C] p-3">
                    <p className="font-semibold text-[#FFB0A4]">Descartar este envio?</p>
                    <p className="mt-1 text-sm text-[#D9B4AE]">
                      Ele sairá da lista de formulários pendentes.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setConfirmDiscard(false)}
                        className="min-h-11 border border-border px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => resolve({ action: "descartar" })}
                        className="min-h-11 bg-[#E8604C] px-3 text-sm font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
                      >
                        Confirmar descarte
                      </button>
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <p className="border-l-2 border-[#E8604C] bg-[#351D1C] px-3 py-2 text-sm text-[#FF9A8B]" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : (
            <p className="border-l-2 border-[#60A5FA] bg-[#131722] p-3 text-sm text-muted-foreground">
              Somente o administrador pode aplicar ou descartar formulários.
            </p>
          )}
        </PanelSection>
      </div>
    </>
  );
}

function PaymentRegistration({
  totalPago,
  isentoPagamento,
  inscricaoPendente,
  editable,
  hasEnrollment,
  entries,
  onRegister,
  onSetExemption,
  onDelete,
}: {
  totalPago: number;
  isentoPagamento: boolean;
  inscricaoPendente: boolean;
  editable: boolean;
  hasEnrollment: boolean;
  entries: CashEntry[];
  onRegister: (data: string, valor: number) => Promise<boolean>;
  onSetExemption: (isento: boolean) => Promise<boolean>;
  onDelete: (entry: CashEntry) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(localIsoDate);
  const [amount, setAmount] = useState("20,00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId,setDeletingId]=useState<number|null>(null);

  async function toggleExemption() {
    setSubmitting(true);
    await onSetExemption(!isentoPagamento);
    setSubmitting(false);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseCurrencyToCents(amount);
    if (!date) {
      setError("Informe a data do pagamento.");
      return;
    }
    if (!cents) {
      setError("Informe um valor maior que zero.");
      return;
    }

    setError(null);
    setSubmitting(true);
    const ok = await onRegister(date, cents);
    setSubmitting(false);
    if (ok) {
      setOpen(false);
      setAmount("20,00");
    }
  }

  return (
    <div
      className={cn(
        "border-l-2 bg-[#131722] p-3",
        isentoPagamento
          ? "border-[#00E676]"
          : inscricaoPendente
            ? "border-[#60A5FA]"
            : "border-[#00E676]",
      )}
    >
      <div className="flex min-h-11 items-center justify-between gap-3">
        <div>
          <p className="font-semibold">
            {isentoPagamento
              ? "Pagamento isento"
              : !hasEnrollment
                ? "Pagamento registrado"
              : inscricaoPendente
                ? "Inscrição pendente"
                : "Inscrição em dia"}
          </p>
          <p className="font-data mt-1 text-sm text-muted-foreground">
            Total pago: {formatCurrency(totalPago)}
          </p>
        </div>
        {editable && hasEnrollment && !open && (
          <div className="flex shrink-0 flex-col gap-2">
            <button type="button" onClick={() => setOpen(true)} className="min-h-11 border border-[#60A5FA] px-3 text-sm font-bold text-[#60A5FA] outline-none hover:bg-[#272B13] focus-visible:ring-2 focus-visible:ring-[#60A5FA]">Registrar pagamento</button>
            <button type="button" disabled={submitting} onClick={toggleExemption} className="min-h-11 border border-[#00E676] px-3 text-sm font-semibold text-[#73FFB0] outline-none focus-visible:ring-2 focus-visible:ring-[#00E676] disabled:opacity-50">{isentoPagamento ? "Remover isenção" : "Marcar isento"}</button>
          </div>
        )}
      </div>

      {entries.length>0&&<div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-[.1em] text-muted-foreground">Pagamentos registrados</p><div className="space-y-2">{entries.slice().sort((a,b)=>b.data.localeCompare(a.data)||b.id-a.id).map((entry)=><div key={entry.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 bg-[#0D1118] px-3 py-2"><span className="min-w-0"><strong className="font-data block text-sm">{formatCurrency(entry.valor)}</strong><span className="block text-xs text-muted-foreground">{formatShortDate(entry.data)} · {entry.tipo}</span></span>{editable&&<AlertDialog><AlertDialogTrigger asChild><button type="button" aria-label={`Excluir pagamento de ${formatCurrency(entry.valor)}`} className="flex size-11 items-center justify-center text-[#FF8A78] hover:bg-[#351D1C] focus-visible:ring-2 focus-visible:ring-[#E8604C]"><Trash2 className="size-4"/></button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir este pagamento?</AlertDialogTitle><AlertDialogDescription>O lançamento de {formatCurrency(entry.valor)} será apagado e a situação do piloto será recalculada.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={deletingId===entry.id} onClick={()=>{setDeletingId(entry.id);void onDelete(entry).finally(()=>setDeletingId(null));}} className="bg-[#E8604C] text-white hover:bg-[#F07160]">{deletingId===entry.id?"Excluindo…":"Excluir pagamento"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>)}</div></div>}

      {!editable && (
        <p className="mt-2 text-xs text-muted-foreground">
          Somente o administrador pode registrar pagamentos.
        </p>
      )}

      {editable&&!hasEnrollment&&<p className="mt-2 text-xs text-muted-foreground">O piloto não está inscrito na temporada atual. Os lançamentos existentes ainda podem ser excluídos abaixo.</p>}

      {open && (
        <form onSubmit={submit} className="mt-3 border-t border-border pt-3">
          <div className="grid grid-cols-2 gap-2">
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Data
              </span>
              <input
                type="date"
                required
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="font-data h-11 w-full border border-border bg-[#0D1118] px-3 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
              />
            </label>
            <label>
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Valor (R$)
              </span>
              <input
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                className="font-data h-11 w-full border border-border bg-[#0D1118] px-3 outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30"
              />
            </label>
          </div>
          {error && (
            <p className="mt-2 text-sm text-[#FF8A78]" role="alert">
              {error}
            </p>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setOpen(false);
                setError(null);
              }}
              className="min-h-11 border border-border px-3 text-sm font-semibold outline-none hover:border-[#515A69] focus-visible:ring-2 focus-visible:ring-[#60A5FA]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 bg-[#60A5FA] px-3 text-sm font-bold text-[#0A0C10] outline-none hover:bg-[#EFFF5A] focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#131722] disabled:opacity-60"
            >
              {submitting ? "Salvando…" : "Salvar pagamento"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function PanelSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof UserRound;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border p-5">
      <h2 className="font-display mb-4 flex items-center gap-2 text-xl font-bold uppercase tracking-wide">
        <Icon className="size-5 text-[#60A5FA]" aria-hidden="true" />
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function EditableField({
  label,
  field,
  value,
  editable,
  required = false,
  mono = false,
  multiline = false,
  inputType = "text",
  onSave,
}: {
  label: string;
  field: string;
  value: string | null;
  editable: boolean;
  required?: boolean;
  mono?: boolean;
  multiline?: boolean;
  inputType?: "text" | "date";
  onSave: (field: string, value: unknown) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  async function commit() {
    if (!editing) return;
    const normalized = draft.trim();
    if (required && !normalized) {
      setDraft(value ?? "");
      setEditing(false);
      return;
    }
    if (normalized === (value ?? "")) {
      setEditing(false);
      return;
    }
    const ok = await onSave(field, normalized || null);
    if (!ok) setDraft(value ?? "");
    setEditing(false);
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {editing ? (
        multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setDraft(value ?? "");
                setEditing(false);
              }
            }}
            className={cn(
              "min-h-24 w-full resize-y border border-[#60A5FA] bg-[#0D1118] px-3 py-3 text-base outline-none focus:ring-2 focus:ring-[#60A5FA]/30",
              mono && "font-data",
            )}
          />
        ) : (
          <input
            autoFocus
            type={inputType}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(value ?? "");
                setEditing(false);
              }
            }}
            className={cn(
              "h-11 w-full border border-[#60A5FA] bg-[#0D1118] px-3 text-base outline-none focus:ring-2 focus:ring-[#60A5FA]/30",
              mono && "font-data",
            )}
          />
        )
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            if (!editable) return;
            setDraft(value ?? "");
            setEditing(true);
          }}
          className={cn(
            "min-h-11 w-full border border-border bg-[#131722] px-3 py-2 text-left text-base outline-none focus-visible:border-[#60A5FA] focus-visible:ring-2 focus-visible:ring-[#60A5FA]/30",
            editable && "hover:border-[#515A69]",
            mono && "font-data",
          )}
        >
          {value ? (
            inputType === "date" ? formatShortDate(value) : value
          ) : (
            <span className="text-[#60A5FA]">Pendente</span>
          )}
        </button>
      )}
    </div>
  );
}

function NumericEditableField({
  label,
  field,
  value,
  editable,
  onSave,
}: {
  label: string;
  field: string;
  value: number | null;
  editable: boolean;
  onSave: (field: string, value: unknown) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value === null ? "" : String(value));

  async function commit() {
    if (!editing) return;
    const trimmed = draft.trim();
    const normalized = trimmed === "" ? null : Number(trimmed);
    if (
      normalized !== null &&
      (!Number.isInteger(normalized) || normalized < 0)
    ) {
      setDraft(value === null ? "" : String(value));
      setEditing(false);
      return;
    }
    if (normalized === value) {
      setEditing(false);
      return;
    }
    const ok = await onSave(field, normalized);
    if (!ok) setDraft(value === null ? "" : String(value));
    setEditing(false);
  }

  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {editing ? (
        <input
          autoFocus
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(value === null ? "" : String(value));
              setEditing(false);
            }
          }}
          className="font-data h-11 w-full border border-[#60A5FA] bg-[#0D1118] px-3 text-base outline-none focus:ring-2 focus:ring-[#60A5FA]/30"
        />
      ) : (
        <button
          type="button"
          disabled={!editable}
          onClick={() => {
            if (!editable) return;
            setDraft(value === null ? "" : String(value));
            setEditing(true);
          }}
          className={cn(
            "font-data min-h-11 w-full border border-border bg-[#131722] px-3 py-2 text-left text-base outline-none focus-visible:border-[#60A5FA] focus-visible:ring-2 focus-visible:ring-[#60A5FA]/30",
            editable && "hover:border-[#515A69]",
          )}
        >
          {value === null ? (
            <span className="font-sans text-[#60A5FA]">Pendente</span>
          ) : (
            value
          )}
        </button>
      )}
    </div>
  );
}

function NativeSelectField({
  label,
  value,
  options,
  editable,
  onSave,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  editable: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const [draftValue, setDraftValue] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraftValue(value), [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <select
        value={draftValue}
        disabled={!editable || saving}
        onChange={async (event) => {
          const next = event.target.value;
          const previous = draftValue;
          setDraftValue(next);
          setSaving(true);
          const ok = await onSave(next);
          if (!ok) setDraftValue(previous);
          setSaving(false);
        }}
        className="h-11 w-full border border-border bg-[#131722] px-3 text-base outline-none focus:border-[#60A5FA] focus:ring-2 focus:ring-[#60A5FA]/30 disabled:appearance-none disabled:opacity-100"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ReadOnlyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <p className={cn("min-h-11 border border-border bg-[#131722] px-3 py-2", mono && "font-data")}>
        {value || <span className="text-[#60A5FA]">Pendente</span>}
      </p>
    </div>
  );
}

function searchableText(record: ListRecord): string {
  return normalize(
    [
      record.apelido,
      record.nomeCompleto,
      record.psn,
      record.simgrid,
      record.cidade,
      record.whatsapp,
      record.kind === "piloto" ? record.motivoSaida : null,
      record.kind === "piloto" ? record.previsaoVolta : null,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function registrationMatchScore(
  form: PendingFormListItem,
  person: PilotListItem | QueueListItem,
): number {
  let score = 0;
  const formPhone = form.whatsapp?.replace(/\D/g, "");
  const personPhone = person.whatsapp?.replace(/\D/g, "");
  if (formPhone && personPhone && formPhone === personPhone) score += 8;
  if (sameRegistrationValue(form.email, person.email)) score += 5;
  if (sameRegistrationValue(form.psn, person.psn)) score += 4;
  if (sameRegistrationValue(form.simgrid, person.simgrid)) score += 4;
  if (sameRegistrationValue(form.nomeCompleto, person.nomeCompleto)) score += 2;
  return score;
}

function sameRegistrationValue(
  first: string | null,
  second: string | null,
): boolean {
  return Boolean(first && second && normalize(first) === normalize(second));
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function makeWhatsappUrl(phone: string | null, message?: string): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  const international =
    phone.trim().startsWith("+") ||
    (digits.startsWith("55") && digits.length >= 12);
  const base = `https://wa.me/${international ? digits : `55${digits}`}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

function localIsoDate(): string {
  const now = new Date();
  const localTime = now.getTime() - now.getTimezoneOffset() * 60_000;
  return new Date(localTime).toISOString().slice(0, 10);
}

function parseCurrencyToCents(value: string): number | null {
  const compact = value.replace(/\s/g, "").replace(/^R\$/i, "");
  const normalized = compact.includes(",")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100);
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatShortDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatDayMonth(value: string): string {
  const parts = value.split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
}
