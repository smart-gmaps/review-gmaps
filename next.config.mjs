/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Public code route ditangani sebagai halaman biasa (bukan redirect
  // level Next.js) karena keputusan redirect harus dicek ke DB dulu.
};

export default nextConfig;
