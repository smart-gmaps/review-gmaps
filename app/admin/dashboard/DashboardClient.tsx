"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

interface CardRow {
  id: string;
  public_code: string;
  status: "UNINITIALIZED" | "ACTIVE" | "DISABLED";
  business_name: string | null;
  business_address: string | null;
  activated_at: string | null;
  created_at: string;
}

interface GeneratedCard {
  id: string;
  public_code: string;
  pin: string;
}

export default function DashboardClient({ adminName }: { adminName: string }) {
  const router = useRouter();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedBatch, setGeneratedBatch] = useState<GeneratedCard[] | null>(null);
  const [genCount, setGenCount] = useState(10);
  const [message, setMessage] = useState<string | null>(null);

  const loadCards = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("q", search);
    const res = await fetch(`/api/admin/cards?${params}`);
    const data = await res.json();
    setCards(data.cards ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, statusFilter, search]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  async function generate() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: genCount }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Gagal membuat kartu.");
      return;
    }
    setGeneratedBatch(data.cards);
    loadCards();
  }

  async function cardAction(id: string, action: string) {
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/admin/cards/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Gagal melakukan aksi.");
      return;
    }
    if (action === "reset-pin") {
      setMessage(`PIN baru: ${data.newPin} (catat sekarang, tidak akan ditampilkan lagi)`);
    }
    loadCards();
  }

  function downloadGeneratedCsv() {
    if (!generatedBatch) return;
    const base = window.location.origin;
    const header = "public_code,pin,qr_url";
    const rows = generatedBatch.map((c) => `${c.public_code},${c.pin},${base}/${c.public_code}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kartu-baru.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function logout() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="w-full max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard Admin ({adminName})</h1>
        <div className="flex gap-3">
          <a href="/api/admin/export" className="text-sm text-brand-blue underline">
            Export CSV
          </a>
          <button onClick={logout} className="text-sm text-brand-muted underline">
            Keluar
          </button>
        </div>
      </div>

      <section className="card-surface p-6 mb-6">
        <h2 className="font-medium text-gray-900">Generate Kartu Baru</h2>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={500}
            className="input-field w-32"
            value={genCount}
            onChange={(e) => setGenCount(Number(e.target.value))}
          />
          <button className="btn-primary" onClick={generate} disabled={loading}>
            Generate
          </button>
        </div>
        {message && <p className="mt-3 text-sm text-brand-muted">{message}</p>}

        {generatedBatch && (
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-900">
              {generatedBatch.length} kartu dibuat. PIN hanya ditampilkan sekali di sini — simpan/cetak sekarang.
            </p>
            <div className="mt-2 max-h-48 overflow-y-auto text-xs font-mono">
              {generatedBatch.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <span>
                    {c.public_code} — PIN: {c.pin}
                  </span>
                  <a className="text-brand-blue underline" href={`/api/admin/cards/${c.id}/qr`}>
                    QR
                  </a>
                </div>
              ))}
            </div>
            <button onClick={downloadGeneratedCsv} className="mt-3 text-sm text-brand-blue underline">
              Download CSV batch ini
            </button>
          </div>
        )}
      </section>

      <section className="card-surface p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="font-medium text-gray-900 mr-auto">Daftar Kartu ({total})</h2>
          <select
            className="input-field w-auto"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Semua status</option>
            <option value="UNINITIALIZED">Kosong</option>
            <option value="ACTIVE">Aktif</option>
            <option value="DISABLED">Nonaktif</option>
          </select>
          <input
            className="input-field w-auto"
            placeholder="Cari kode / nama bisnis"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-brand-muted border-b">
                <th className="py-2 pr-4">Kode</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Bisnis</th>
                <th className="py-2 pr-4">Dibuat</th>
                <th className="py-2 pr-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-4 font-mono">{c.public_code}</td>
                  <td className="py-2 pr-4">{c.status}</td>
                  <td className="py-2 pr-4">{c.business_name ?? "-"}</td>
                  <td className="py-2 pr-4">{new Date(c.created_at).toLocaleDateString("id-ID")}</td>
                  <td className="py-2 pr-4">
                    <div className="flex flex-wrap gap-2">
                      {c.status !== "DISABLED" ? (
                        <button className="text-xs text-red-600 underline" onClick={() => cardAction(c.id, "disable")}>
                          Nonaktifkan
                        </button>
                      ) : (
                        <button className="text-xs text-green-600 underline" onClick={() => cardAction(c.id, "enable")}>
                          Aktifkan kembali
                        </button>
                      )}
                      <button className="text-xs text-brand-muted underline" onClick={() => cardAction(c.id, "reset")}>
                        Reset
                      </button>
                      <button className="text-xs text-brand-muted underline" onClick={() => cardAction(c.id, "reset-pin")}>
                        Reset PIN
                      </button>
                      <a className="text-xs text-brand-blue underline" href={`/api/admin/cards/${c.id}/qr`}>
                        QR
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="underline disabled:opacity-40">
            Sebelumnya
          </button>
          <span>Halaman {page}</span>
          <button
            disabled={page * 25 >= total}
            onClick={() => setPage((p) => p + 1)}
            className="underline disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </section>
    </div>
  );
}
