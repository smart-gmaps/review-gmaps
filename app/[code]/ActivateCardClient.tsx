"use client";

import { useState } from "react";

type Step = "pin" | "search" | "confirm" | "success";

interface PlaceResult {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  googleMapsUrl: string;
  writeReviewUrl: string;
}

export default function ActivateCardClient({ code }: { code: string }) {
  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${code}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "PIN salah.");
        return;
      }
      setStep("search");
    } finally {
      setLoading(false);
    }
  }

  async function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${code}/search-business`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mencari bisnis.");
        return;
      }
      setResults(data.results);
    } finally {
      setLoading(false);
    }
  }

  async function confirmActivate() {
    if (!selected) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${code}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selected.placeId,
          businessName: selected.displayName,
          businessAddress: selected.formattedAddress,
          googleMapsUrl: selected.googleMapsUrl,
          writeReviewUrl: selected.writeReviewUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengaktifkan kartu.");
        return;
      }
      setStep("success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-surface w-full max-w-sm p-8">
      {step === "pin" && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Kartu belum diaktifkan</h1>
          <p className="mt-2 text-sm text-brand-muted text-center">
            Masukkan PIN yang tertera pada kartu Anda untuk mengaktifkannya.
          </p>
          <form onSubmit={submitPin} className="mt-6 flex flex-col gap-3">
            <input
              className="input-field text-center tracking-[0.3em] text-lg"
              inputMode="numeric"
              maxLength={8}
              placeholder="••••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button className="btn-primary" disabled={loading || pin.length < 4}>
              {loading ? "Memeriksa..." : "Aktifkan Kartu"}
            </button>
          </form>
        </>
      )}

      {step === "search" && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Cari bisnis Anda</h1>
          <p className="mt-2 text-sm text-brand-muted text-center">
            Ketik nama atau alamat bisnis untuk menemukannya di Google.
          </p>
          <form onSubmit={submitSearch} className="mt-6 flex flex-col gap-3">
            <input
              className="input-field"
              placeholder="Nama bisnis / lokasi"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button className="btn-primary" disabled={loading || query.trim().length < 2}>
              {loading ? "Mencari..." : "Cari"}
            </button>
          </form>

          {results.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 max-h-72 overflow-y-auto">
              {results.map((r) => (
                <li key={r.placeId}>
                  <button
                    onClick={() => {
                      setSelected(r);
                      setStep("confirm");
                    }}
                    className="w-full text-left rounded-2xl border border-gray-200 p-3 hover:border-brand-blue transition"
                  >
                    <p className="font-medium text-gray-900 text-sm">{r.displayName}</p>
                    <p className="text-xs text-brand-muted mt-0.5">{r.formattedAddress}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {step === "confirm" && selected && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Konfirmasi</h1>
          <p className="mt-2 text-sm text-brand-muted text-center">
            Kartu akan mengarahkan pelanggan ke halaman review:
          </p>
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <p className="font-medium text-gray-900">{selected.displayName}</p>
            <p className="text-sm text-brand-muted mt-1">{selected.formattedAddress}</p>
          </div>
          {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
          <div className="mt-6 flex flex-col gap-3">
            <button className="btn-primary" onClick={confirmActivate} disabled={loading}>
              {loading ? "Mengaktifkan..." : "Aktifkan"}
            </button>
            <button
              className="text-sm text-brand-muted underline"
              onClick={() => setStep("search")}
              disabled={loading}
            >
              Pilih bisnis lain
            </button>
          </div>
        </>
      )}

      {step === "success" && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Kartu berhasil diaktifkan</h1>
          <p className="mt-2 text-sm text-brand-muted text-center">
            Sekarang setiap scan akan mengarahkan pelanggan langsung ke halaman review Google Anda.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <a href={`/${code}`} className="btn-primary text-center block">
              Coba Kartu
            </a>
            <a href="/" className="text-sm text-brand-muted underline text-center">
              Kembali
            </a>
          </div>
        </>
      )}
    </div>
  );
}
