import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/useAuth";

export default function LoginPage() {
  const { user, signIn, signUp, sendMagicLink } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp" | "magic">("signIn");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      let result;
      if (mode === "signIn") {
        result = await signIn(email, password);
      } else if (mode === "signUp") {
        result = await signUp(email, password);
      } else {
        result = await sendMagicLink(email);
      }

      if (result.error) {
        setError(result.error.message);
      } else {
        setError("Check your email for confirmation/magic link.");
      }
    } catch (err) {
      setError("Unexpected error.");
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-md mx-auto mt-8">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          User Authentication
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          {mode === "signIn" && "Sign in with your existing credentials"}
          {mode === "signUp" && "Create a new account"}
          {mode === "magic" && "Send a magic link to your email"}
        </p>

        <div className="flex gap-2 mb-4">
          {(["signIn", "signUp", "magic"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`rounded-md px-3 py-2 text-sm ${mode === item ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              {item === "signIn"
                ? "Sign In"
                : item === "signUp"
                  ? "Sign Up"
                  : "Magic Link"}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs text-muted-foreground">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground"
            />
          </label>

          {mode !== "magic" && (
            <label className="block">
              <span className="text-xs text-muted-foreground">Password</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                className="w-full mt-1 px-3 py-2 rounded-md border border-border bg-background text-foreground"
              />
            </label>
          )}

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {mode === "signIn"
              ? "Sign In"
              : mode === "signUp"
                ? "Sign Up"
                : "Send Magic Link"}
          </button>

          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </form>
      </div>
    </AppLayout>
  );
}
