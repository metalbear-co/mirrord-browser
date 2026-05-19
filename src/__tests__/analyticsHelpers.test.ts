import { emitUserBlocked, emitUserSucceeded } from '../analytics';

global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true } as Response)
) as jest.Mock;

beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
});

describe('emitUserBlocked', () => {
    it('captures with the umbrella event name, reason, kind, surface', async () => {
        emitUserBlocked('join_failed', 'user_action', { error: 'boom' });
        await Promise.resolve();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(
            (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(body.event).toBe('extension_user_blocked');
        expect(body.properties.reason).toBe('join_failed');
        expect(body.properties.kind).toBe('user_action');
        expect(body.properties.surface).toBe('extension');
        expect(body.properties.error).toBe('boom');
    });
});

describe('emitUserSucceeded', () => {
    it('captures with the umbrella success event, reason, kind, surface', async () => {
        emitUserSucceeded('joined', 'user_action', { key: 'abc' });
        await Promise.resolve();
        expect(global.fetch).toHaveBeenCalledTimes(1);
        const body = JSON.parse(
            (global.fetch as jest.Mock).mock.calls[0][1].body
        );
        expect(body.event).toBe('extension_user_succeeded');
        expect(body.properties.reason).toBe('joined');
        expect(body.properties.kind).toBe('user_action');
        expect(body.properties.surface).toBe('extension');
        expect(body.properties.key).toBe('abc');
    });
});
