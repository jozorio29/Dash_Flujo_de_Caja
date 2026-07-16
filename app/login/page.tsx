"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";

function LoginContent() {
  const params = useSearchParams();
  const router = useRouter();
  const callbackUrl = params.get("callbackUrl") || "/";
  const urlError = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const errorMessage =
    formError ??
    (urlError === "AccessDenied"
      ? "Tu email no está autorizado para acceder a este dashboard."
      : urlError === "CredentialsSignin"
      ? "Email o contraseña incorrectos."
      : urlError
      ? "Ocurrió un error al iniciar sesión. Intenta de nuevo."
      : null);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setFormError("Email o contraseña incorrectos.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200 lg:grid-cols-2">
        {/* ── Panel izquierdo: formulario ─────────────────────────── */}
        <div className="flex flex-col justify-center px-8 py-10 sm:px-12">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-[#f2f2f2] shadow-md">
              <img
                src="/xtendo-logo.svg"
                alt="Xtendo"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Xtendo</div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Flujo de Caja
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inicia sesión 
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Usa tu cuenta de Google de la empresa o tus credenciales.
          </p>

          {errorMessage && (
            <div className="mt-5 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{errorMessage}</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => signIn("google", { callbackUrl })}
            className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <GoogleIcon />
            Continuar con Google
          </button>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              o
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={
                    showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              ¿Olvidaste tu contraseña? Contacta al administrador.
            </p>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Iniciar sesión
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Acceso restringido. Solo usuarios autorizados pueden ver los datos.
          </p>
        </div>

        {/* ── Panel derecho: preview ──────────────────────────────── */}
        <div className="relative hidden flex-col justify-center overflow-hidden bg-gradient-to-br from-[#0B1B3B] via-blue-900 to-blue-700 p-10 lg:flex">
          <div className="relative z-10">
            <p className="text-lg font-medium leading-snug text-blue-100">
              Gestiona el flujo de caja de tu empresa{" "}
              <span className="font-semibold text-white">
                con datos en tiempo real
              </span>
            </p>

            {/* Mock del dashboard */}
            <div className="mt-8 rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/20">
              <div className="flex gap-3">
                {/* mini sidebar */}
                <div className="hidden w-20 shrink-0 flex-col gap-2 rounded-lg bg-[#0B1B3B] p-2 xl:flex">
                  <div className="h-2 w-10 rounded bg-white/40" />
                  <div className="mt-2 h-1.5 w-full rounded bg-blue-400/60" />
                  <div className="h-1.5 w-full rounded bg-white/15" />
                  <div className="h-1.5 w-full rounded bg-white/15" />
                  <div className="h-1.5 w-full rounded bg-white/15" />
                </div>
                {/* contenido */}
                <div className="min-w-0 flex-1">
                  <div className="mb-3 h-2 w-24 rounded bg-slate-300" />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-emerald-50 p-2 ring-1 ring-emerald-100">
                      <div className="h-1.5 w-8 rounded bg-emerald-300" />
                      <div className="mt-1.5 h-2.5 w-12 rounded bg-emerald-500" />
                    </div>
                    <div className="rounded-lg bg-rose-50 p-2 ring-1 ring-rose-100">
                      <div className="h-1.5 w-8 rounded bg-rose-300" />
                      <div className="mt-1.5 h-2.5 w-12 rounded bg-rose-400" />
                    </div>
                    <div className="rounded-lg bg-blue-50 p-2 ring-1 ring-blue-100">
                      <div className="h-1.5 w-8 rounded bg-blue-300" />
                      <div className="mt-1.5 h-2.5 w-12 rounded bg-blue-500" />
                    </div>
                  </div>
                  {/* barras */}
                  <div className="mt-3 flex h-20 items-end gap-1.5 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-100">
                    {[35, 55, 40, 70, 50, 85, 60, 75, 45, 90, 65, 80].map(
                      (h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className={
                            i % 3 === 1
                              ? "flex-1 rounded-t bg-blue-300"
                              : "flex-1 rounded-t bg-blue-600"
                          }
                        />
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* decoración */}
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a10.99 10.99 0 000 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-500">Cargando…</div>}>
      <LoginContent />
    </Suspense>
  );
}
