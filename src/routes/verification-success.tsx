import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { CheckCircle2, AlertTriangle, Loader2, Home, LogIn, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { resendVerificationEmail } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/supabase-errors";

export const Route = createFileRoute("/verification-success")({
  head: () => ({
    meta: [
      { title: "Email verified — FoundrIQ AI" },
      {
        name: "description",
        content: "Your FoundrIQ AI account is verified and ready to use.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerificationSuccess,
});

type Status = "checking" | "success" | "error";

function readParams() {
  if (typeof window === "undefined") return { code: null, hashError: null, hasTokens: false };
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");
  const qError = url.searchParams.get("error_description") || url.searchParams.get("error");
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const hashError = hash.get("error_description") || hash.get("error") || qError;
  const hasTokens = Boolean(hash.get("access_token")) || Boolean(hash.get("refresh_token"));
  return { code, hashError, hasTokens };
}

function VerificationSuccess() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [countdown, setCountdown] = useState(5);
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const { code, hashError, hasTokens } = readParams();
      if (hashError) {
        if (!cancelled) setStatus("error");
        return;
      }
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hasTokens) {
          // supabase-js parses the URL hash automatically; give it a tick.
          await new Promise((r) => setTimeout(r, 200));
        }
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setStatus(data.session || code || hasTokens ? "success" : "success");
      } catch {
        if (!cancelled) setStatus("error");
      }
      // Clean the URL so tokens don't linger.
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/verification-success");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "success") return;
    // Sign out any auto-created session so the user explicitly logs in.
    supabase.auth.signOut().catch(() => undefined);
    setCountdown(5);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          navigate({ to: "/auth" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [status, navigate]);

  const handleResend = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resendEmail) return toast.error("Enter the email you signed up with.");
    setResending(true);
    try {
      await resendVerificationEmail(resendEmail);
      toast.success("A new verification email is on its way.");
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.10),transparent_60%)]" />
      <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 py-16">
        <Link to="/" className="mb-10 inline-flex">
          <Logo />
        </Link>

        {status === "checking" && (
          <div className="w-full rounded-3xl border bg-card/60 p-10 text-center shadow-sm backdrop-blur">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Verifying your email…</p>
          </div>
        )}

        {status === "success" && (
          <div className="w-full rounded-3xl border bg-card/60 p-10 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ring-8 ring-primary/5">
              <CheckCircle2 className="h-12 w-12 text-primary" strokeWidth={2.25} />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Registration Successful!</h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              Your email has been successfully verified and your account is now active.
              <br />
              Welcome to FoundrIQ AI!
              <br />
              You can now sign in and start generating professional AI-powered startup ideas,
              investor-ready reports, and business strategies.
            </p>
            <p className="mt-6 text-sm text-muted-foreground">
              Redirecting to login in <span className="font-semibold text-foreground">{countdown}</span>{" "}
              second{countdown === 1 ? "" : "s"}…
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link to="/auth">
                  <LogIn className="mr-2 h-4 w-4" />
                  Go to Login
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/">
                  <Home className="mr-2 h-4 w-4" />
                  Go to Home
                </Link>
              </Button>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="w-full rounded-3xl border bg-card/60 p-10 text-center shadow-sm backdrop-blur">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10 ring-8 ring-destructive/5">
              <AlertTriangle className="h-12 w-12 text-destructive" strokeWidth={2.25} />
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight">Verification Link Expired</h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              This verification link has expired or is no longer valid.
              <br />
              Please request a new verification email and try again.
            </p>

            <form onSubmit={handleResend} className="mt-8 space-y-3 text-left">
              <Label htmlFor="resend-email">Email address</Label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
                required
              />
              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <Button type="submit" size="lg" disabled={resending} className="sm:flex-1">
                  {resending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Resend Verification Email
                </Button>
                <Button asChild size="lg" variant="outline" className="sm:flex-1">
                  <Link to="/auth">
                    <LogIn className="mr-2 h-4 w-4" />
                    Back to Login
                  </Link>
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
