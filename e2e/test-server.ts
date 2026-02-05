import http from 'node:http';

const PORT = parseInt(process.env.TEST_SERVER_PORT || '3456', 10);

const server = http.createServer((req, res) => {
    if (req.url === '/headers') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(req.headers));
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`Test server listening on http://localhost:${PORT}`);
});
