export default function NotFound() {
  return (
    <div className="card-surface w-full max-w-sm p-8 text-center">
      <h1 className="text-lg font-semibold text-gray-900">Kartu tidak ditemukan</h1>
      <p className="mt-2 text-sm text-brand-muted">
        Periksa kembali QR/link yang Anda gunakan, atau hubungi admin.
      </p>
    </div>
  );
}
