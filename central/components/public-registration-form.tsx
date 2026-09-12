"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Send,
} from "lucide-react";
import Image from "next/image";
import {
  type FormEvent,
  type KeyboardEvent,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
} from "react";

import { addressFields, approvalNotice, gt7Ratings, registrationLinks, registrationSummary, validateAddress, validateEmail, validateRegistration } from "@/lib/registration";

type FieldKind =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "textarea"
  | "location"
  | "rating";

type RegistrationField = {
  name: string;
  eyebrow: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  kind: FieldKind;
};

const fields: RegistrationField[] = [
  {
    name: "nomeCompleto",
    eyebrow: "Identificação",
    label: "Qual é o seu nome completo?",
    placeholder: "Digite seu nome e sobrenome",
    required: true,
    kind: "text",
  },
  {
    name: "whatsapp",
    eyebrow: "Contato",
    label: "Qual é o seu WhatsApp?",
    description: "Inclua o DDD para conseguirmos falar com você.",
    placeholder: "(11) 99999-9999",
    required: true,
    kind: "tel",
  },
  {
    name: "email",
    eyebrow: "Contato",
    label: "Qual é o seu melhor e-mail?",
    placeholder: "voce@exemplo.com",
    required: true,
    kind: "email",
  },
  {
    name: "psn",
    eyebrow: "Identidade na pista",
    label: "Qual é a sua ID da PSN?",
    placeholder: "Sua ID na PlayStation Network",
    required: true,
    kind: "text",
  },
  { name: "cidade", eyebrow: "Endereço", label: "Qual é o seu endereço?", description: "CEP, rua, número, bairro, cidade e UF são obrigatórios. Complemento é opcional.", required: true, kind: "location" },
  { name: "classificacaoGt7", eyebrow: "Na pista", label: "Qual sua classificação no Gran Turismo 7?", description: "Informe sua classificação de piloto.", required: true, kind: "rating" },
];

export function PublicRegistrationForm() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const [returnToReview, setReturnToReview] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const submissionId = useRef("");
  const sending = useRef(false);
  const [emailStatus, setEmailStatus] = useState("failed");
  const [retrying, setRetrying] = useState(false);
  const [redirectPaused, setRedirectPaused] = useState(false);
  useEffect(() => {
    if (status !== "success" || redirectPaused) return;
    const timer = window.setTimeout(() => window.location.assign(registrationLinks.whatsapp), 8000);
    return () => window.clearTimeout(timer);
  }, [status, redirectPaused]);

  async function retryEmail() {
    setRedirectPaused(true);
    setRetrying(true);
    try {
      const response = await fetch("/central/api/cadastro/reenviar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ submissionId: submissionId.current }) });
      const result = await response.json();
      setEmailStatus(result.emailStatus ?? "failed");
      setMessage(result.emailStatus === "sent" ? "Orientações enviadas para seu e-mail." : result.error ?? "Não foi possível reenviar agora. Tente novamente em um minuto.");
    } catch { setMessage("Não foi possível reenviar agora. Seu cadastro continua salvo."); }
    finally { setRetrying(false); }
  }

  const isWelcome = step === 0;
  const isReview = step === fields.length + 1;
  const field = step > 0 && step <= fields.length ? fields[step - 1] : null;
  const completedQuestions = isReview ? fields.length : Math.max(0, step - 1);
  const progress = Math.round((completedQuestions / fields.length) * 100);

  useEffect(() => {
    if (!field) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 180);
    return () => window.clearTimeout(timer);
  }, [field]);

  function setValue(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }));
    setMessage("");
    if (status === "error") setStatus("idle");
  }

  function validateCurrent() {
    if (!field) return true;
    const value = (values[field.name] ?? "").trim();
    if (field.required && !value) {
      setMessage("Este campo é necessário para continuar.");
      return false;
    }
    if (field.name === "whatsapp" && value.replace(/\D/g, "").length < 10) {
      setMessage("Confira o WhatsApp e informe também o DDD.");
      return false;
    }
    if (field.name === "email") {
      const error = validateEmail(value);
      if (error) { setMessage(error); return false; }
    }
    if (field.kind === "location") {
      const error = validateAddress(values);
      if (error) { setMessage(error); return false; }
    }
    return true;
  }

  function next() {
    if (!validateCurrent()) return;
    setMessage("");
    if (returnToReview) {
      setReturnToReview(false);
      setStep(fields.length + 1);
      return;
    }
    setStep((current) => Math.min(fields.length + 1, current + 1));
  }

  function back() {
    setMessage("");
    if (returnToReview) {
      setReturnToReview(false);
      setStep(fields.length + 1);
      return;
    }
    setStep((current) => Math.max(0, current - 1));
  }

  function handleTextareaKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      next();
    }
  }

  async function submitRegistration() {
    if (!privacyAccepted) {
      setStatus("error");
      setMessage("Confirme que você leu o aviso de privacidade antes de enviar.");
      return;
    }
    if (sending.current) return;
    const error = validateRegistration(values);
    if (error) { setStatus("error"); setMessage(error); return; }
    sending.current = true;
    if (!submissionId.current) submissionId.current = crypto.randomUUID();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/central/api/cadastro", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, submissionId: submissionId.current, privacyAccepted }),
      });
      const result = (await response.json()) as { error?: string; emailStatus?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível enviar.");
      setEmailStatus(result.emailStatus ?? "failed");
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Erro ao enviar.");
    } finally { sending.current = false; }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isReview) {
      void submitRegistration();
      return;
    }
    next();
  }

  if (status === "success") {
    return (
      <main className="registration-shell flex min-h-dvh items-center justify-center px-4 py-10 text-foreground">
        <section className="registration-success w-full max-w-xl border border-[#00E676]/30 bg-[#131722] p-6 sm:p-10">
          <span className="flex size-14 items-center justify-center border border-[#00E676]/40 bg-[#00E676]/10 text-[#00E676]">
            <CheckCircle2 className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-[#00E676]">Cadastro recebido</p>
          <h1 className="font-display mt-2 text-4xl font-bold uppercase leading-none sm:text-6xl">Tudo certo.</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
            Seus dados foram enviados e ficarão aguardando a conferência da administração da Speed GT Brasil.
          </p>
          <p className="mt-4 text-base leading-7">{approvalNotice}</p>
          <dl className="mt-6 divide-y divide-white/10">{registrationSummary(values).map(([key, label, value]) => <div key={key} className="py-3"><dt className="text-sm text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl>
          <p className="mt-4 text-sm" role="status">{emailStatus === "sent" ? "As orientações foram enviadas para seu e-mail. Confira também o spam." : "Seu cadastro está salvo, mas ainda não confirmamos o envio do e-mail."}</p>
          {emailStatus !== "sent" && <button type="button" disabled={retrying} onClick={() => void retryEmail()} className="mt-3 min-h-12 text-[#60A5FA] underline disabled:opacity-50">{retrying ? "Reenviando…" : "Tentar enviar e-mail novamente"}</button>}
          {message && <p role="status" className="mt-2 text-sm">{message}</p>}
          {!redirectPaused && <><p className="mt-5 text-sm text-muted-foreground">Você será direcionado ao WhatsApp em alguns segundos.</p><button type="button" onClick={() => setRedirectPaused(true)} className="min-h-11 text-sm underline">Permanecer nesta página</button></>}
          <a href={registrationLinks.whatsapp} className="mt-3 flex min-h-14 items-center justify-center bg-[#60A5FA] px-5 font-bold text-[#0A0C10]">Ir para o grupo do WhatsApp</a>
        </section>
      </main>
    );
  }

  return (
    <main className="registration-shell min-h-dvh text-foreground">
      <header className="registration-header border-b border-border bg-[#0D1016]">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 sm:px-6">
          <Image
            src="/central/brand/speed-gt-brasil.png"
            alt="Speed GT Brasil"
            width={64}
            height={64}
            unoptimized
            priority
            className="size-12 object-contain sm:size-14"
          />
          {!isWelcome && (
            <div className="min-w-0 flex-1 px-2 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <span>{isReview ? "Revisão final" : `Pergunta ${step} de ${fields.length}`}</span>
                <span className="font-data text-[#60A5FA]">{progress}%</span>
              </div>
              <div
                className="h-1 overflow-hidden bg-white/10"
                role="progressbar"
                aria-label="Progresso do cadastro"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progress}
              >
                <div className="registration-progress h-full bg-[#60A5FA]" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>
      </header>

      {isWelcome ? (
        <section key="welcome" className="registration-step mx-auto flex min-h-[calc(100dvh-81px)] max-w-4xl items-center px-5 py-12 sm:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#60A5FA]">Cadastro de piloto</p>
            <h1 className="font-display mt-4 text-5xl font-bold uppercase leading-[0.95] sm:text-7xl">
              Antes de acelerar,<br />deixe tudo em dia.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Responda seis perguntas para entrar na comunidade Speed GT Brasil. Depois da confirmação, você recebe as orientações por e-mail e segue para o WhatsApp.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex min-h-14 items-center gap-3 bg-[#60A5FA] px-6 text-base font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0C10]"
              >
                Começar <ArrowRight className="size-5" aria-hidden="true" />
              </button>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="size-4" aria-hidden="true" /> cerca de 3 minutos
              </span>
            </div>
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit} className="mx-auto max-w-5xl">
          <label className="sr-only" aria-hidden="true">
            Empresa
            <input
              name="empresa"
              tabIndex={-1}
              autoComplete="off"
              value={values.empresa ?? ""}
              onChange={(event) => setValue("empresa", event.target.value)}
            />
          </label>

          {field && (
            <section key={field.name} className="registration-step flex min-h-[calc(100dvh-145px)] items-center px-5 py-10 pb-28 sm:px-10">
              <div className="w-full max-w-3xl">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#00E676]">{field.eyebrow}</p>
                <label htmlFor={`registration-${field.name}`} className="mt-3 block">
                  <span className="font-display block text-3xl font-bold uppercase leading-tight sm:text-5xl">
                    <span className="font-data mr-3 text-lg not-italic text-[#60A5FA]">{step} →</span>
                    {field.label}
                  </span>
                  {field.description && (
                    <span className="mt-3 block max-w-2xl text-base leading-7 text-muted-foreground">{field.description}</span>
                  )}
                </label>

                <div className="mt-8">
                  <RegistrationControl
                    field={field}
                    values={values}
                    setValue={setValue}
                    inputRef={inputRef}
                    onTextareaKeyDown={handleTextareaKeyDown}
                  />
                </div>

                {message && (
                  <p className="mt-4 border-l-2 border-[#E8604C] pl-3 text-sm text-[#FF9A8B]" role="alert">{message}</p>
                )}

                {(
                  <div className="mt-7 flex flex-wrap items-center gap-4">
                    <button
                      type="submit"
                      className="flex min-h-12 items-center gap-2 bg-[#60A5FA] px-5 font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0C10]"
                    >
                      OK <Check className="size-4" aria-hidden="true" />
                    </button>
                    {!field.required && !values[field.name] && (
                      <button type="button" onClick={next} className="min-h-12 px-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                        Pular pergunta
                      </button>
                    )}
                    <span className="hidden text-xs text-muted-foreground sm:inline">
                      Enter para continuar{field.kind === "textarea" ? " · Shift + Enter quebra linha" : ""}
                    </span>
                  </div>
                )}
              </div>
            </section>
          )}

          {isReview && (
            <ReviewStep
              values={values}
              status={status}
              message={message}
              privacyAccepted={privacyAccepted}
              onPrivacyAccepted={setPrivacyAccepted}
              onEdit={(fieldName) => {
                setReturnToReview(true);
                setStep(fields.findIndex((item) => item.name === fieldName) + 1);
              }}
            />
          )}

          <footer className="registration-footer fixed inset-x-0 bottom-0 z-30 border-t border-border bg-[#0D1016]/95 px-4 py-3 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between">
              <button type="button" disabled={status === "sending"} onClick={back} className="flex min-h-10 items-center gap-2 px-2 text-sm font-semibold text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden="true" /> Voltar
              </button>
              {!isReview && <span className="text-xs text-muted-foreground">As respostas ficam salvas enquanto esta página estiver aberta.</span>}
            </div>
          </footer>
        </form>
      )}
    </main>
  );
}

function RegistrationControl({
  field,
  values,
  setValue,
  inputRef,
  onTextareaKeyDown,
}: {
  field: RegistrationField;
  values: Record<string, string>;
  setValue: (name: string, value: string) => void;
  inputRef: MutableRefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  onTextareaKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const sharedInputClass = "registration-input w-full border-0 border-b-2 border-white/20 bg-transparent px-0 py-3 text-2xl text-foreground outline-none placeholder:text-[#515A69] focus:border-[#60A5FA] focus:ring-0 sm:text-3xl";

  if (field.kind === "rating") {
    return <div role="radiogroup" aria-label={field.label} className="grid grid-cols-3 gap-3 sm:grid-cols-7">{gt7Ratings.map(option => <label key={option} className={`flex min-h-20 cursor-pointer items-center justify-center gap-2 border p-3 text-xl font-bold ${values.classificacaoGt7 === option ? "border-[#60A5FA] bg-[#60A5FA]/10" : "border-white/20"}`}><input type="radio" name="classificacaoGt7" value={option} checked={values.classificacaoGt7 === option} onChange={() => setValue("classificacaoGt7", option)} className="accent-[#60A5FA]" required />{option}</label>)}</div>;
  }
  if (field.kind === "location") {
    return <div className="grid gap-5 sm:grid-cols-2">{addressFields.map(([name, label]) => <label key={name} className="block text-sm text-muted-foreground">{label}{name !== "complemento" ? " *" : " (opcional)"}<input ref={name === "cep" ? element => { inputRef.current = element; } : undefined} id={name === "cidade" ? "registration-cidade" : undefined} name={name} value={values[name] ?? ""} onChange={event => setValue(name, name === "uf" ? event.target.value.toUpperCase() : event.target.value)} maxLength={name === "uf" ? 2 : name === "cep" ? 9 : 120} required={name !== "complemento"} autoComplete={name === "cep" ? "postal-code" : name === "cidade" ? "address-level2" : name === "uf" ? "address-level1" : "off"} className={sharedInputClass + " text-xl sm:text-2xl"} /></label>)}</div>;
  }

  if (field.kind === "textarea") {
    return (
      <textarea
        ref={(element) => { inputRef.current = element; }}
        id={`registration-${field.name}`}
        name={field.name}
        rows={3}
        value={values[field.name] ?? ""}
        onChange={(event) => setValue(field.name, event.target.value)}
        onKeyDown={onTextareaKeyDown}
        placeholder={field.placeholder}
        maxLength={500}
        className={`${sharedInputClass} min-h-32 resize-none leading-snug`}
      />
    );
  }

  return (
    <input
      ref={(element) => { inputRef.current = element; }}
      id={`registration-${field.name}`}
      name={field.name}
      type={field.kind}
      required={field.required}
      inputMode={field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : "text"}
      autoComplete={field.name === "nomeCompleto" ? "name" : field.name === "whatsapp" ? "tel" : field.name === "email" ? "email" : "off"}
      value={values[field.name] ?? ""}
      onChange={(event) => setValue(field.name, event.target.value)}
      placeholder={field.placeholder}
      maxLength={500}
      className={sharedInputClass}
    />
  );
}

function ReviewStep({
  values,
  status,
  message,
  privacyAccepted,
  onPrivacyAccepted,
  onEdit,
}: {
  values: Record<string, string>;
  status: "idle" | "sending" | "success" | "error";
  message: string;
  privacyAccepted: boolean;
  onPrivacyAccepted: (accepted: boolean) => void;
  onEdit: (fieldName: string) => void;
}) {
  const entries = registrationSummary(values);

  return (
    <section key="review" className="registration-step min-h-[calc(100dvh-145px)] px-5 py-10 pb-28 sm:px-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#00E676]">Revisão final</p>
        <h1 className="font-display mt-3 text-4xl font-bold uppercase leading-tight sm:text-6xl">Confira antes da bandeirada.</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Confira seus dados e toque em editar para corrigir. Ao confirmar, seu cadastro será enviado para análise.</p>

        <dl className="mt-8 border-y border-white/10">
          {entries.map(([fieldName, label, value]) => (
            <div key={fieldName} className="grid gap-2 border-b border-white/10 py-4 last:border-b-0 sm:grid-cols-[160px_1fr_auto] sm:items-start">
              <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-base leading-6 text-foreground">{value}</dd>
              <button type="button" disabled={status === "sending"} onClick={() => onEdit(fieldName)} className="justify-self-start text-sm font-bold text-[#60A5FA] hover:underline sm:justify-self-end">Editar</button>
            </div>
          ))}
        </dl>

        <aside className="mt-7 border-l-4 border-[#60A5FA] bg-[#131722] p-4 sm:p-5">
          <h2 className="text-base font-bold text-[#60A5FA]">Os próximos passos chegam por e-mail</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Vamos enviar para o e-mail informado um tutorial de como participar dos nossos campeonatos pelo SimGrid. O cadastro no SimGrid é necessário para se inscrever em um campeonato, mas você não precisa fazê-lo agora. Prepare sua conta quando decidir participar.</p>
        </aside>

        <div className="mt-7 border border-white/10 bg-[#131722] p-4 sm:p-5">
          <details className="privacy-notice group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-bold uppercase tracking-[0.06em] text-[#60A5FA]">
              Privacidade e uso dos seus dados
              <span className="font-data text-lg transition-transform group-open:rotate-45" aria-hidden="true">+</span>
            </summary>
            <div className="mt-4 space-y-3 border-t border-white/10 pt-4 text-sm leading-6 text-muted-foreground">
              <p>
                A administração da Speed GT Brasil utilizará os dados deste formulário para identificar pilotos, validar cadastros, organizar competições e grids, manter contato e administrar a participação na liga.
              </p>
              <p>
                O acesso será limitado à equipe de administração e coordenação conforme a necessidade. As informações serão mantidas pelo período necessário às atividades da liga e à preservação de seus registros administrativos, com medidas razoáveis de segurança.
              </p>
              <p>
                Você pode solicitar confirmação do tratamento, acesso, correção, atualização ou eliminação dos seus dados pelos canais oficiais da administração. A exclusão poderá ser limitada quando a manutenção do registro for necessária para cumprir obrigação aplicável ou resguardar o histórico legítimo da competição.
              </p>
              <p>
                Se você for menor de idade, peça que seu responsável legal acompanhe o preenchimento e procure a administração antes do envio.
              </p>
            </div>
          </details>

          <label className="mt-5 flex cursor-pointer items-start gap-3 border-t border-white/10 pt-4">
            <input
              type="checkbox"
              checked={privacyAccepted}
              onChange={(event) => onPrivacyAccepted(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#60A5FA]"
            />
            <span className="text-sm leading-6 text-foreground">
              Li o aviso de privacidade e estou ciente de como meus dados serão utilizados.
            </span>
          </label>
        </div>

        {status === "error" && (
          <p className="mt-5 border-l-2 border-[#E8604C] bg-[#351D1C] px-3 py-2 text-sm text-[#FF9A8B]" role="alert">{message}</p>
        )}

        <button
          type="submit"
          disabled={status === "sending" || !privacyAccepted}
          className="mt-8 flex min-h-14 w-full items-center justify-center gap-3 bg-[#60A5FA] px-6 text-base font-bold text-[#0A0C10] outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0A0C10] disabled:opacity-60 sm:w-auto"
        >
          <Send className="size-5" aria-hidden="true" />
          {status === "sending" ? "Enviando…" : "Confirmar cadastro"}
        </button>
      </div>
    </section>
  );
}
