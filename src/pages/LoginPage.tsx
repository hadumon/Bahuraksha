import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/components/auth/useAuth";

export default function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");

  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    try {
      const result =
        mode === "signIn"
          ? await signIn(email, password)
          : await signUp(email, password);

      if (result.error) {
        setError(result.error.message);
      } else {
        setError(
          mode === "signUp"
            ? "Account created. You can sign in immediately once email confirmation is disabled in Supabase."
            : "",
        );
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
        </p>

        <div className="flex gap-2 mb-4">
          {(["signIn", "signUp"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={`rounded-md px-3 py-2 text-sm ${mode === item ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-secondary/80"}`}
            >
              {item === "signIn" ? "Sign In" : "Sign Up"}
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

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            {mode === "signIn" ? "Sign In" : "Sign Up"}
          </button>

          {error && <p className="text-xs text-danger mt-2">{error}</p>}
        </form>
      </div>
    </AppLayout>
  );
}
