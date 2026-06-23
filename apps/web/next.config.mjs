/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Emit a self-contained server (.next/standalone/server.js) so the prod
  // Docker image can run `node server.js` without a full node_modules install.
  output: "standalone"
};

export default nextConfig;
