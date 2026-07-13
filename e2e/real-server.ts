import { spawn } from 'node:child_process';
import fs from 'node:fs';
import type { TestInfo } from '@playwright/test';

export interface RealServer {
    baseUrl: string;
    token: string;
    authUrl: string;
    logFile: string | null;
    stop: () => Promise<void>;
    attachDiagnostics: (testInfo: TestInfo) => Promise<void>;
}

const BANNER_TIMEOUT_MS = 20_000;
const DEFAULT_PORT = 59298;

function parseBanner(output: string): {
    url: string | null;
    token: string | null;
    pid: number | null;
    logFile: string | null;
    alreadyRunning: boolean;
} {
    const urlMatch =
        /(http:\/\/127\.0\.0\.1:\d+)\/auth\?token=([a-f0-9]+)/.exec(output);
    const pidMatch = /Server PID:\s*\n?\s*->\s*(\d+)/.exec(output);
    const logMatch = /server log file:\s*(\S+)/.exec(output);
    return {
        url: urlMatch?.[1] ?? null,
        token: urlMatch?.[2] ?? null,
        pid: pidMatch ? Number(pidMatch[1]) : null,
        logFile: logMatch?.[1] ?? null,
        alreadyRunning: output.includes('already running'),
    };
}

export async function startRealServer(): Promise<RealServer | null> {
    const attachedUrl = process.env.MIRRORD_UI_URL;
    const attachedToken = process.env.MIRRORD_UI_TOKEN;
    if (attachedUrl && attachedToken) {
        return {
            baseUrl: attachedUrl.replace(/\/$/, ''),
            token: attachedToken,
            authUrl: `${attachedUrl.replace(/\/$/, '')}/auth?token=${attachedToken}&redirect=/`,
            logFile: null,
            stop: () => Promise.resolve(),
            attachDiagnostics: () => Promise.resolve(),
        };
    }

    const binary = process.env.MIRRORD_BIN;
    if (!binary) return null;

    const port = Number(process.env.MIRRORD_UI_PORT ?? DEFAULT_PORT);
    const child = spawn(binary, ['ui', '--port', String(port)], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const banner = await new Promise<ReturnType<typeof parseBanner>>(
        (resolve, reject) => {
            const timer = setTimeout(() => {
                child.kill();
                reject(
                    new Error(
                        `mirrord ui did not print its banner within ${BANNER_TIMEOUT_MS}ms:\n${output}`
                    )
                );
            }, BANNER_TIMEOUT_MS);
            const onData = (chunk: Buffer) => {
                output += chunk.toString();
                const parsed = parseBanner(output);
                if (parsed.alreadyRunning) {
                    clearTimeout(timer);
                    reject(
                        new Error(
                            'a mirrord ui daemon is already running; stop it or set MIRRORD_UI_URL/MIRRORD_UI_TOKEN to attach to it'
                        )
                    );
                    return;
                }
                if (parsed.url && parsed.token) {
                    clearTimeout(timer);
                    resolve(parsed);
                }
            };
            child.stdout.on('data', onData);
            child.stderr.on('data', onData);
            child.on('exit', () => {
                const parsed = parseBanner(output);
                if (parsed.url && parsed.token && !parsed.alreadyRunning) {
                    clearTimeout(timer);
                    resolve(parsed);
                }
            });
        }
    );

    if (!banner.url || !banner.token) {
        throw new Error(`could not parse mirrord ui banner:\n${output}`);
    }

    const { url, token, pid, logFile } = banner;
    return {
        baseUrl: url,
        token,
        authUrl: `${url}/auth?token=${token}&redirect=/`,
        logFile,
        stop: () => {
            if (pid) {
                try {
                    process.kill(pid);
                } catch {
                    return Promise.resolve();
                }
            }
            return Promise.resolve();
        },
        attachDiagnostics: async (testInfo: TestInfo) => {
            if (logFile && fs.existsSync(logFile)) {
                await testInfo.attach('mirrord-ui-server.log', {
                    path: logFile,
                    contentType: 'text/plain',
                });
            }
        },
    };
}
