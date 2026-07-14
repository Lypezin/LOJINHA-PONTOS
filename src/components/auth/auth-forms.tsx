"use client";

import { type FormEvent, type InputHTMLAttributes, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Send,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatCnpj } from "@/lib/auth/identity";

type ApiResult = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
  redirectTo?: string;
  resetUrl?: string;
};

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  icon: typeof Mail;
};

const fieldClassName =
  "min-h-12 w-full rounded-xl border border-[#BCC1CB] bg-white py-3 pl-11 pr-4 text-base text-[var(--brand-navy)] outline-none placeholder:text-[#738097] hover:border-[var(--brand-blue)] focus:border-[var(--brand-blue)] disabled:cursor-not-allowed disabled:bg-[#EFF2F6] disabled:text-[#52617A]";

function Field({ label, error, hint, icon: Icon, id: suppliedId, className, ...props }: FieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const descriptionId = `${id}-description`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-[var(--brand-navy)]">
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#52617A]"
        />
        <input
          {...props}
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          className={cn(fieldClassName, error && "border-[#A61620]", className)}
        />
      </div>
      {(error || hint) && (
        <p
          id={descriptionId}
          className={cn("mt-2 text-pretty text-sm leading-5", error ? "font-semibold text-[#A61620]" : "text-[#52617A]")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

type PasswordFieldProps = Omit<FieldProps, "icon" | "type">;

function PasswordField({ label, error, hint, id: suppliedId, className, ...props }: PasswordFieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const descriptionId = `${id}-description`;
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-bold text-[var(--brand-navy)]">
        {label}
      </label>
      <div className="relative">
        <LockKeyhole
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[#52617A]"
        />
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? descriptionId : undefined}
          className={cn(fieldClassName, "pr-12", error && "border-[#A61620]", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-xl text-[#52617A] hover:bg-[#EEF3FF] hover:text-[var(--brand-blue-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          disabled={props.disabled}
        >
          {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </button>
      </div>
      {(error || hint) && (
        <p
          id={descriptionId}
          className={cn("mt-2 text-pretty text-sm leading-5", error ? "font-semibold text-[#A61620]" : "text-[#52617A]")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

function SubmitButton({ pending, idleText, pendingText }: { pending: boolean; idleText: string; pendingText: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-blue)] px-6 py-3 font-bold text-white shadow-sm hover:bg-[var(--brand-blue-dark)] active:bg-[var(--brand-blue-dark)] disabled:cursor-not-allowed disabled:bg-[#8DAAF0]"
    >
      {pending ? (
        <>
          <LoaderCircle aria-hidden="true" className="size-5" />
          {pendingText}
        </>
      ) : (
        <>
          {idleText}
          <ArrowRight aria-hidden="true" className="size-5" />
        </>
      )}
    </button>
  );
}

function FormMessage({ message, success = false }: { message?: string; success?: boolean }) {
  if (!message) return null;
  return (
    <div
      role={success ? "status" : "alert"}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-pretty text-sm font-semibold leading-6",
        success
          ? "border-[#B7EBDD] bg-[#E9FBF6] text-[#0F4938]"
          : "border-[#F0C4C7] bg-[#FFF0F0] text-[#A61620]",
      )}
    >
      {success ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /> : null}
      <span>{message}</span>
    </div>
  );
}

async function postAuth(endpoint: string, payload: object): Promise<ApiResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as ApiResult | null;
  if (!data) throw new Error("invalid-response");
  return data;
}

export function LoginForm({ initialMessage }: { initialMessage?: string }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    setFieldErrors({});

    try {
      const result = await postAuth("/api/auth/login", { identifier, password });
      if (!result.ok) {
        setMessage(result.message ?? "Não foi possível entrar.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.replace(result.redirectTo ?? "/loja");
      router.refresh();
    } catch {
      setMessage("Não foi possível acessar sua conta. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      {initialMessage ? <FormMessage message={initialMessage} success /> : null}
      <FormMessage message={message} />
      <Field
        label="E-mail ou CNPJ"
        icon={IdCard}
        type="text"
        name="identifier"
        autoComplete="username"
        placeholder="voce@exemplo.com ou 00.000.000/0000-00"
        value={identifier}
        onChange={(event) => {
          const value = event.target.value;
          setIdentifier(/^[\d.\/\-\s]*$/.test(value) ? formatCnpj(value) : value);
        }}
        error={fieldErrors.identifier?.[0]}
        disabled={pending}
        required
      />
      <div>
        <PasswordField
          label="Senha"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password?.[0]}
          disabled={pending}
          required
        />
        <div className="mt-2 text-right">
          <Link href="/esqueci-senha" className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--brand-blue-dark)] hover:underline">
            Esqueci minha senha
          </Link>
        </div>
      </div>
      <SubmitButton pending={pending} idleText="Entrar" pendingText="Entrando" />
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setFieldErrors({});

    if (password !== confirmation) {
      setFieldErrors({ confirmation: ["As senhas não coincidem."] });
      return;
    }

    setPending(true);
    try {
      const result = await postAuth("/api/auth/register", { cnpj, email, password });
      if (!result.ok) {
        setMessage(result.message ?? "Não foi possível concluir o cadastro.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }

      router.replace(result.redirectTo ?? "/loja");
      router.refresh();
    } catch {
      setMessage("Não foi possível concluir o cadastro. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormMessage message={message} />
      <Field
        label="CNPJ"
        icon={IdCard}
        name="cnpj"
        inputMode="numeric"
        autoComplete="username"
        placeholder="00.000.000/0000-00"
        value={cnpj}
        onChange={(event) => setCnpj(formatCnpj(event.target.value))}
        error={fieldErrors.cnpj?.[0]}
        hint="Use o mesmo CNPJ cadastrado pela empresa. Se ele estiver na base e ainda não tiver conta, seus dados e pontos serão vinculados automaticamente."
        disabled={pending}
        required
      />
      <Field
        label="E-mail"
        icon={Mail}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email?.[0]}
        disabled={pending}
        required
      />
      <PasswordField
        label="Crie uma senha"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password?.[0]}
        hint="Use de 8 a 72 caracteres, com pelo menos uma letra e um número."
        disabled={pending}
        required
      />
      <PasswordField
        label="Repita a senha"
        name="confirmation"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={fieldErrors.confirmation?.[0]}
        disabled={pending}
        required
      />
      <SubmitButton pending={pending} idleText="Criar minha conta" pendingText="Criando conta" />
      <p className="text-pretty text-xs leading-5 text-[#52617A]">
        Ao criar sua conta, seus pontos e seu nome serão ligados ao CNPJ informado.
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [resetUrl, setResetUrl] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(undefined);
    setSuccess(false);
    setResetUrl(undefined);
    setFieldErrors({});

    try {
      const result = await postAuth("/api/auth/forgot-password", { email });
      setMessage(result.message ?? "Não foi possível enviar as instruções.");
      setSuccess(Boolean(result.ok));
      setResetUrl(result.resetUrl);
      setFieldErrors(result.fieldErrors ?? {});
    } catch {
      setMessage("Não foi possível solicitar a recuperação. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormMessage message={message} success={success} />
      <Field
        label="E-mail cadastrado"
        icon={Mail}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="voce@exemplo.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors.email?.[0]}
        disabled={pending}
        required
      />
      <button
        type="submit"
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-blue)] px-6 py-3 font-bold text-white shadow-sm hover:bg-[var(--brand-blue-dark)] disabled:cursor-not-allowed disabled:bg-[#8DAAF0]"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="size-5" /> : <Send aria-hidden="true" className="size-5" />}
        {pending ? "Enviando instruções" : "Enviar instruções"}
      </button>
      {resetUrl ? (
        <div className="rounded-xl border border-[#C9D7F8] bg-[#EEF3FF] p-4 text-sm text-[var(--brand-blue-dark)]">
          <p className="font-bold">Atalho disponível no ambiente de desenvolvimento</p>
          <Link href={resetUrl} className="mt-2 inline-flex min-h-11 items-center font-bold underline">
            Abrir link de redefinição
          </Link>
        </div>
      ) : null}
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  if (!token) {
    return (
      <div className="space-y-5">
        <FormMessage message="Este link de redefinição está incompleto ou é inválido." />
        <Link
          href="/esqueci-senha"
          className="flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--brand-blue)] px-6 py-3 font-bold text-white hover:bg-[var(--brand-blue-dark)]"
        >
          Solicitar um novo link
        </Link>
      </div>
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setSuccess(false);
    setFieldErrors({});

    if (password !== confirmation) {
      setFieldErrors({ confirmation: ["As senhas não coincidem."] });
      return;
    }

    setPending(true);
    try {
      const result = await postAuth("/api/auth/reset-password", { token, password });
      setMessage(result.message ?? "Não foi possível redefinir a senha.");
      setSuccess(Boolean(result.ok));
      setFieldErrors(result.fieldErrors ?? {});
      if (result.ok) {
        setPassword("");
        setConfirmation("");
      }
    } catch {
      setMessage("Não foi possível redefinir a senha. Verifique sua conexão e tente novamente.");
    } finally {
      setPending(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-5">
        <FormMessage message={message} success />
        <Link
          href="/login?senha=redefinida"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--brand-blue)] px-6 py-3 font-bold text-white hover:bg-[var(--brand-blue-dark)]"
        >
          Entrar com a nova senha
          <ArrowRight aria-hidden="true" className="size-5" />
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormMessage message={message} />
      <PasswordField
        label="Nova senha"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password?.[0]}
        hint="Use de 8 a 72 caracteres, com pelo menos uma letra e um número."
        disabled={pending}
        required
      />
      <PasswordField
        label="Repita a nova senha"
        name="confirmation"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={fieldErrors.confirmation?.[0]}
        disabled={pending}
        required
      />
      <SubmitButton pending={pending} idleText="Salvar nova senha" pendingText="Salvando senha" />
    </form>
  );
}

export function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(undefined);
    setFieldErrors({});
    if (password !== confirmation) {
      setFieldErrors({ confirmation: ["As senhas não coincidem."] });
      return;
    }
    setPending(true);
    try {
      const result = await postAuth("/api/auth/change-password", { currentPassword, password });
      if (!result.ok) {
        setMessage(result.message ?? "Não foi possível alterar a senha.");
        setFieldErrors(result.fieldErrors ?? {});
        return;
      }
      router.replace(result.redirectTo ?? "/login");
      router.refresh();
    } catch {
      setMessage("Não foi possível alterar a senha. Tente novamente.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <FormMessage message={message} />
      <PasswordField
        label="Senha atual"
        name="currentPassword"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
        error={fieldErrors.currentPassword?.[0]}
        disabled={pending}
        required
      />
      <PasswordField
        label="Nova senha"
        name="password"
        autoComplete="new-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        error={fieldErrors.password?.[0]}
        hint="Use de 8 a 72 caracteres, com pelo menos uma letra e um número."
        disabled={pending}
        required
      />
      <PasswordField
        label="Repita a nova senha"
        name="confirmation"
        autoComplete="new-password"
        value={confirmation}
        onChange={(event) => setConfirmation(event.target.value)}
        error={fieldErrors.confirmation?.[0]}
        disabled={pending}
        required
      />
      <SubmitButton pending={pending} idleText="Salvar nova senha" pendingText="Salvando senha" />
    </form>
  );
}
