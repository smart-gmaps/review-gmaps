"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email atau password salah.");
      return;
    }
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <div className="card-surface w-full max-w-sm p-8">
      <h1 className="text-lg font-semibold text-gray-900 text-center">Masuk Admin</h1>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <input
          className="input-field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600 text-center">{error}</p>}
        <button className="btn-primary" disabled={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </button>
      </form>
      <p className="mt-4 text-xs text-brand-muted text-center">
        Akun admin dibuat lewat Supabase Auth (lihat README).
      </p>
    </div>
  );
}
