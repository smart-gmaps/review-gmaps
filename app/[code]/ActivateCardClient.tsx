"use client";

import { useState } from "react";

type Step = "pin" | "link" | "confirm" | "success";

interface ResolvedLink {
  cid: string;
  businessName: string;
  mapsUrl: string;
  writeReviewUrl: string;
}

export default function ActivateCardClient({ code }: { code: string }) {
  const [step, setStep] = useState<Step>("pin");
  const [pin, setPin] = useState("");
  const [link, setLink] = useState("");
  const [resolved, setResolved] = useState<ResolvedLink | null>(null);
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
      setStep("link");
    } finally {
      setLoading(false);
    }
  }

  async function submitLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${code}/resolve-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ link }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal memproses link.");
        return;
      }
      setResolved(data.result);
      setStep("confirm");
    } finally {
      setLoading(false);
    }
  }

  async function confirmActivate() {
    if (!resolved) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/cards/${code}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: resolved.cid,
          businessName: resolved.businessName,
          googleMapsUrl: resolved.mapsUrl,
          writeReviewUrl: resolved.writeReviewUrl,
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

      {step === "link" && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Tempel link Google Maps bisnis Anda</h1>
          <ol className="mt-3 text-sm text-brand-muted list-decimal list-inside space-y-1">
            <li>Buka Google Maps, cari bisnis Anda sendiri.</li>
            <li>Tap tombol <span className="font-medium text-gray-800">Share / Bagikan</span>.</li>
            <li>Pilih <span className="font-medium text-gray-800">Copy link</span>, lalu tempel di bawah ini.</li>
          </ol>
          <form onSubmit={submitLink} className="mt-5 flex flex-col gap-3">
            <input
              className="input-field"
              placeholder="https://maps.app.goo.gl/..."
              value={link}
              onChange={(e) => setLink(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button className="btn-primary" disabled={loading || link.trim().length < 5}>
              {loading ? "Memproses..." : "Lanjutkan"}
            </button>
          </form>
        </>
      )}

      {step === "confirm" && resolved && (
        <>
          <h1 className="text-lg font-semibold text-gray-900 text-center">Konfirmasi</h1>
          <p className="mt-2 text-sm text-brand-muted text-center">
            Kartu akan mengarahkan pelanggan ke halaman review:
          </p>
          <div className="mt-4 rounded-2xl bg-gray-50 p-4">
            <p className="font-medium text-gray-900">{resolved.businessName}</p>
            <p className="text-xs text-brand-muted mt-1 break-all">{resolved.mapsUrl}</p>
          </div>
          <p className="mt-3 text-xs text-brand-muted text-center">
            Pastikan nama di atas benar-benar bisnis Anda sebelum melanjutkan.
          </p>
          {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}
          <div className="mt-6 flex flex-col gap-3">
            <button className="btn-primary" onClick={confirmActivate} disabled={loading}>
              {loading ? "Mengaktifkan..." : "Aktifkan"}
            </button>
            <button
              className="text-sm text-brand-muted underline"
              onClick={() => setStep("link")}
              disabled={loading}
            >
              Tempel link lain
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
