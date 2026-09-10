"use client";

import { useState } from "react";

interface CardInfo {
  status: string;
  businessName: string | null;
}

export default function ManageClient() {
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<CardInfo | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const verifyRes = await fetch(`/api/cards/${code}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error ?? "Kode atau PIN salah.");
        return;
      }

      const statusRes = await fetch(`/api/cards/${code}/status`);
      const statusData = await statusRes.json();
      setInfo({ status: statusData.status, businessName: statusData.businessName });
    } finally {
      setLoading(false);
    }
  }

  async function resetCard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cards/${code}/reset`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mereset kartu.");
        return;
      }
      window.location.href = `/${code}`;
    } finally {
      setLoading(false);
    }
  }

  if (!info) {
    return (
      <div className="card-surface w-full max-w-sm p-8">
        <h1 className="text-lg font-semibold text-gray-900 text-center">Kelola Kartu</h1>
        <p className="mt-2 text-sm text-brand-muted text-center">
          Masukkan kode kartu dan PIN Anda.
        </p>
        <form onSubmit={login} className="mt-6 flex flex-col gap-3">
          <input
            className="input-field"
            placeholder="Kode kartu"
            value={code}
            onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
            autoCapitalize="characters"
          />
          <input
            className="input-field text-center tracking-[0.3em]"
            inputMode="numeric"
            maxLength={8}
            placeholder="PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          />
          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          <button className="btn-primary" disabled={loading || !code || pin.length < 4}>
            {loading ? "Memeriksa..." : "Masuk"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="card-surface w-full max-w-sm p-8">
      <h1 className="text-lg font-semibold text-gray-900 text-center">Status Kartu</h1>
      <div className="mt-4 rounded-2xl bg-gray-50 p-4 text-sm">
        <p>
          Status: <span className="font-medium">{info.status}</span>
        </p>
        {info.businessName && (
          <p className="mt-1">
            Bisnis: <span className="font-medium">{info.businessName}</span>
          </p>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-600 text-center">{error}</p>}

      <div className="mt-6 flex flex-col gap-3">
        {info.status === "ACTIVE" && (
          <a href={`/${code}`} className="btn-primary text-center block">
            Coba Kartu
          </a>
        )}
        {info.status === "UNINITIALIZED" && (
          <a href={`/${code}`} className="btn-primary text-center block">
            Lanjutkan Aktivasi
          </a>
        )}

        {!confirmReset ? (
          <button className="text-sm text-red-600 underline" onClick={() => setConfirmReset(true)}>
            Reset Kartu
          </button>
        ) : (
          <div className="rounded-2xl border border-red-200 p-4">
            <p className="text-sm text-red-700">
              Reset akan menghapus target bisnis dan mengembalikan kartu menjadi kosong. Yakin?
            </p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary flex-1" onClick={resetCard} disabled={loading}>
                {loading ? "Memproses..." : "Ya, Reset"}
              </button>
              <button
                className="flex-1 rounded-2xl border border-gray-200 text-sm"
                onClick={() => setConfirmReset(false)}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
