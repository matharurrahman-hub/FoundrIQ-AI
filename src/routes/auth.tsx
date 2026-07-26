import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/brand/Logo";
import { ArrowRight, Loader2, Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { sendPasswordReset, signInWithPassword, signUpWithPassword } from "@/hooks/use-auth";
import { friendlyError } from "@/lib/supabase-errors";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — FoundrIQ AI" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Password is required").max(72),
});

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(72)
    .regex(/[A-Z]/, "Include an uppercase letter")
    .regex(/[a-z]/, "Include a lowercase letter")
    .regex(/[0-9]/, "Include a number"),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("signin");
  const [mode, setMode] = useState<"auth" | "forgot">("auth");

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signInSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    try {
      await signInWithPassword(parsed.data.email, parsed.data.password);
      toast.success("Welcome back to FoundrIQ");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(friendlyError(err, "Could not sign you in. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      name: fd.get("name"),
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);

    setLoading(true);
    try {
      const result = await signUpWithPassword(
        parsed.data.email,
        parsed.data.password,
        parsed.data.name.trim(),
      );
      if (result.session) {
        toast.success("Account created. Let's build.");
        navigate({ to: "/app" });
      } else {
        toast.success("Account created. Check your inbox to confirm your email.");
        setTab("signin");
      }
    } catch (err) {
      toast.error(friendlyError(err, "Could not create your account. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) return toast.error("Enter a valid email");
    setLoading(true);
    try {
      await sendPasswordReset(parsed.data);
      toast.success("If an account exists, a reset link has been sent.");
      setMode("auth");
    } catch (err) {
      toast.error(friendlyError(err, "Could not send the reset email. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 lg:grid-cols-2 bg-background">
      <div className="relative hidden overflow-hidden border-r border-border lg:block">
        <div className="absolute inset-0 grid-bg opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Logo />
          <div>
            <blockquote className="max-w-md text-2xl font-medium leading-snug tracking-tight">
              "FoundrIQ compressed six months of founder-work into a single weekend. It's the most valuable tool in my stack."
            </blockquote>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full gradient-brand" />
              <div>
                <div className="text-sm font-medium">Aria Chen</div>
                <div className="text-xs text-muted-foreground">Founder & CEO, Nimbus</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden"><Logo /></div>

          {mode === "forgot" ? (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                We'll email you a secure link to set a new password.
              </p>
              <form onSubmit={handleForgot} className="mt-8 space-y-4">
                <Field id="email" name="email" label="Email" icon={Mail} type="email" placeholder="you@company.com" />
                <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground shadow-glow">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Send reset link <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
                <button type="button" onClick={() => setMode("auth")} className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
                  ← Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Welcome to FoundrIQ</h1>
              <p className="mt-1 text-sm text-muted-foreground">Your AI Co-Founder is waiting.</p>

              <Tabs value={tab} onValueChange={setTab} className="mt-8">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Create account</TabsTrigger>
                </TabsList>

                <div className="mt-6" />

                <TabsContent value="signin" className="space-y-4">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <Field id="si-email" name="email" label="Email" icon={Mail} type="email" placeholder="you@company.com" autoComplete="email" />
                    <Field id="si-password" name="password" label="Password" icon={Lock} type="password" placeholder="••••••••" autoComplete="current-password" />
                    <div className="flex items-center justify-end">
                      <button type="button" onClick={() => setMode("forgot")} className="text-sm text-primary hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground shadow-glow">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="space-y-4">
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <Field id="su-name" name="name" label="Full name" icon={User} placeholder="Alex Founder" autoComplete="name" />
                    <Field id="su-email" name="email" label="Work email" icon={Mail} type="email" placeholder="you@company.com" autoComplete="email" />
                    <Field id="su-password" name="password" label="Password" icon={Lock} type="password" placeholder="At least 8 characters" autoComplete="new-password" />
                    <p className="text-[11px] text-muted-foreground">
                      Must be 8+ characters with uppercase, lowercase, and a number.
                    </p>
                    <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground shadow-glow">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="ml-2 h-4 w-4" /></>}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      By continuing you agree to our <a className="underline underline-offset-2" href="#">Terms</a> and{" "}
                      <a className="underline underline-offset-2" href="#">Privacy</a>.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">← Back to site</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  id, name, label, icon: Icon, type = "text", placeholder, autoComplete,
}: {
  id: string; name: string; label: string; icon: any; type?: string; placeholder?: string; autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input id={id} name={name} type={type} placeholder={placeholder} autoComplete={autoComplete} className="pl-9 h-11 bg-card" required />
      </div>
    </div>
  );
}
