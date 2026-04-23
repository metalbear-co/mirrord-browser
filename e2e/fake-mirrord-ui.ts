import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = parseInt(process.env.FAKE_MIRRORD_UI_PORT || '3457', 10);
const TOKEN = 'test-token';

type Summary = {
    id: string;
    key: string | null;
    namespace: string;
    owner: { username: string; k8sUsername: string } | null;
    target: { kind: string; name: string; container: string } | null;
    createdAt: string | null;
};

const sessions: Summary[] = [
    {
        id: 'a',
        key: 'k1',
        namespace: 'ns-a',
        owner: { username: 'alice', k8sUsername: 'alice@ex' },
        target: { kind: 'Deployment', name: 'web', container: 'app' },
        createdAt: null,
    },
    {
        id: 'b',
        key: 'k1',
        namespace: 'ns-b',
        owner: { username: 'bob', k8sUsername: 'bob@ex' },
        target: { kind: 'Deployment', name: 'api', container: 'app' },
        createdAt: null,
    },
    {
        id: 'c',
        key: 'k2',
        namespace: 'ns-a',
        owner: { username: 'alice', k8sUsername: 'alice@ex' },
        target: null,
        createdAt: null,
    },
];

function snapshot() {
    const by_key: Record<string, Summary[]> = {};
    for (const s of sessions) {
        const k = s.key ?? '';
        (by_key[k] ??= []).push(s);
    }
    return { sessions, by_key, watch_status: { status: 'watching' } };
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200);
        res.end('ok');
        return;
    }

    if (req.method === 'GET' && url.pathname === '/api/operator-sessions') {
        if (url.searchParams.get('token') !== TOKEN) {
            res.writeHead(401);
            res.end('bad token');
            return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(snapshot()));
        return;
    }

    if (req.method === 'POST' && url.pathname === '/__inject/remove') {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
        const id = body.id;
        if (id) {
            const i = sessions.findIndex((s) => s.id === id);
            if (i >= 0) sessions.splice(i, 1);
            for (const client of wss.clients) {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(
                        JSON.stringify({
                            type: 'operator_session_removed',
                            id,
                        })
                    );
                }
            }
        }
        res.writeHead(200);
        res.end('ok');
        return;
    }

    res.writeHead(404);
    res.end('not found');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname !== '/ws' || url.searchParams.get('token') !== TOKEN) {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`fake mirrord ui on http://127.0.0.1:${PORT}`);
});
