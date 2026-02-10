import http from 'node:http';

const PORT = parseInt(process.env.TEST_SERVER_PORT || '3456', 10);

// Store headers received on asset requests so tests can verify injection
const assetHeaders: Record<string, http.IncomingHttpHeaders> = {};

const server = http.createServer((req, res) => {
    if (req.url?.endsWith('/headers')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(req.headers));
    } else if (req.url === '/asset-page') {
        // Serves an HTML page that loads a script, stylesheet, and image from this server
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<head>
    <link rel="stylesheet" href="/assets/style.css">
    <link rel="modulepreload" href="/assets/module.js">
</head>
<body>
    <img src="/assets/logo.png" width="1" height="1">
    <script src="/assets/script.js"></script>
    <p id="status">loaded</p>
</body>
</html>`);
    } else if (req.url?.startsWith('/assets/')) {
        // Record headers for each asset request
        const assetName = req.url.replace('/assets/', '');
        assetHeaders[assetName] = { ...req.headers };

        if (req.url.endsWith('.css')) {
            res.writeHead(200, { 'Content-Type': 'text/css' });
            res.end('body {}');
        } else if (req.url.endsWith('.js')) {
            res.writeHead(200, { 'Content-Type': 'application/javascript' });
            res.end('// noop');
        } else if (req.url.endsWith('.png')) {
            // 1x1 transparent PNG
            const pixel = Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
                    'Nl7BcQAAAABJRU5ErkJggg==',
                'base64'
            );
            res.writeHead(200, { 'Content-Type': 'image/png' });
            res.end(pixel);
        } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('');
        }
    } else if (req.url === '/asset-headers') {
        // Return all recorded asset headers for test verification
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(assetHeaders));
    } else if (req.url === '/asset-headers/reset') {
        // Reset recorded headers between tests
        Object.keys(assetHeaders).forEach((k) => delete assetHeaders[k]);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{}');
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Test server listening on http://localhost:${PORT}`);
});
