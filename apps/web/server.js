const { createServer } = require('node:https');
const { parse } = require('node:url');
const next = require('next');
const fs = require('node:fs');
const path = require('node:path');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = Number.parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Determine cert path based on environment (Docker vs local)
const certDir = fs.existsSync('/app/certs') ? '/app/certs' : path.join(__dirname, '../../certs');
const httpsOptions = {
  key: fs.readFileSync(path.join(certDir, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(certDir, 'localhost-cert.pem')),
};

app.prepare().then(() => {
  createServer(httpsOptions, async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  })
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on https://${hostname}:${port}`);
    });
});
