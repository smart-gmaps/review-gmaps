import Link from "next/link";

export default function HomePage() {
  return (
    <div className="card-surface w-full max-w-sm p-8 text-center">
      <h1 className="text-xl font-semibold text-gray-900">Kartu Review</h1>
      <p className="mt-2 text-sm text-brand-muted">
        Scan QR atau tap kartu NFC Anda untuk membuka halaman review.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        <Link href="/manage" className="btn-primary text-center block">
          Kelola Kartu
        </Link>
        <Link href="/admin/login" className="text-sm text-brand-muted underline">
          Masuk sebagai Admin
        </Link>
      </div>
    </div>
  );
}
