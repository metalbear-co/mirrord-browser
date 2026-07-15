/** @jest-environment jsdom */
import { render, screen, fireEvent, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'
import type { KubeContext, OperatorSessionSummary, OperatorWatchStatus } from '../types'

jest.mock('@metalbear/ui', () => ({
  ErrorBoundary: ({ children }: { children?: React.ReactNode }) => children,
  Card: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  CardContent: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  CardHeader: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  CardTitle: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  CardFooter: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  Separator: () => <hr />,
  cn: (...args: (string | false | null | undefined)[]) => args.filter(Boolean).join(' '),
  Badge: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <span className={className}>{children}</span>
  ),
  Button: ({
    children,
    onClick,
    className,
    'aria-label': ariaLabel,
  }: React.PropsWithChildren<{
    onClick?: () => void
    className?: string
    'aria-label'?: string
  }>) => (
    <button onClick={onClick} className={className} aria-label={ariaLabel}>
      {children}
    </button>
  ),
  Label: ({ children, htmlFor }: React.PropsWithChildren<{ htmlFor?: string }>) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Select: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectTrigger: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
  SelectValue: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
  SelectItem: ({ children, value }: React.PropsWithChildren<{ value?: string }>) => (
    <div data-value={value}>{children}</div>
  ),
  Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    function Input(props, ref) {
      return <input ref={ref} {...props} />
    },
  ),
}))

import { SessionsView } from '../components/SessionsView'

const s = (
  name: string,
  key: string,
  namespace = 'ns',
  createdAt = '2026-01-01T00:00:00Z',
): OperatorSessionSummary => ({
  id: name,
  key,
  namespace,
  owner: { username: 'alice', k8sUsername: 'alice@ex' },
  target: { kind: 'Deployment', name: 'web', container: 'app' },
  createdAt,
})

describe('SessionsView', () => {
  const sessions = [s('a', 'k1', 'ns-a'), s('b', 'k2', 'ns-b'), s('c', 'k3', 'ns-a')]

  const baseProps = {
    sessionsLoaded: true,
    authFailed: false,
    uiDetectedNoToken: false,
    backend: null as string | null,
    namespaces: ['', 'ns-a', 'ns-b'],
    namespace: '',
    setNamespace: jest.fn(),
    contexts: [] as KubeContext[],
    currentContext: null as string | null,
    selectedContext: null as string | null,
    onSelectContext: jest.fn(),
    joinState: {
      joinedKey: null,
      joinedSessionName: null,
    },
    status: { status: 'watching' } as OperatorWatchStatus,
    onJoin: jest.fn(),
    onClear: jest.fn(),
    onShare: jest.fn(),
    scopePatterns: [] as string[],
    onAddScopePattern: jest.fn(),
    onRemoveScopePattern: jest.fn(),
    joinedHeader: null as string | null,
    joinedValue: null as string | null,
  }

  test('renders one group per key, omitting keyless sessions', () => {
    render(<SessionsView {...baseProps} sessions={sessions} />)
    expect(screen.getByText('k1')).toBeInTheDocument()
    expect(screen.getByText('k2')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /join \(no key\)/i })).toBeNull()
  })

  test('counts unique keys, not raw sessions', () => {
    // k3 has two sessions; the count should treat that group as one.
    const withDup = [...sessions, s('d', 'k3', 'ns-a')]
    render(<SessionsView {...baseProps} sessions={withDup} />)
    expect(screen.getByText(/3 live sessions/i)).toBeInTheDocument()
  })

  test('clicking Join on a row calls onJoin with that session key', () => {
    const onJoin = jest.fn()
    render(<SessionsView {...baseProps} sessions={sessions} onJoin={onJoin} />)
    fireEvent.click(screen.getByRole('button', { name: /join k1/i }))
    expect(onJoin).toHaveBeenCalledWith('k1')
  })

  test('shows a connected banner when a session is joined', () => {
    render(
      <SessionsView
        {...baseProps}
        sessions={sessions}
        joinState={{
          joinedKey: 'k1',
          joinedSessionName: 'a',
        }}
      />,
    )
    expect(screen.getByText(/session live/i)).toBeInTheDocument()
    expect(screen.getAllByText('k1').length).toBeGreaterThan(0)
  })

  test('drops the joined session card from the list (no duplicate)', () => {
    render(
      <SessionsView
        {...baseProps}
        sessions={sessions}
        joinState={{
          joinedKey: 'k1',
          joinedSessionName: 'a',
        }}
      />,
    )
    // k1 only appears in the banner, not as a second list card.
    expect(screen.getAllByText('k1')).toHaveLength(1)
    // The remaining keys still render, and the count excludes the joined one.
    expect(screen.getByText('k2')).toBeInTheDocument()
    expect(screen.getByText('k3')).toBeInTheDocument()
    expect(screen.getByText(/2 live sessions/i)).toBeInTheDocument()
  })

  test('banner carries the joined session target, owner, and share button', () => {
    const onShare = jest.fn()
    const joined: OperatorSessionSummary = {
      id: 'j',
      key: 'k9',
      namespace: 'ns',
      owner: { username: 'bob', k8sUsername: 'bob@ex' },
      target: { kind: 'Deployment', name: 'inventory', container: 'app' },
      createdAt: '2026-01-01T00:00:00Z',
    }
    render(
      <SessionsView
        {...baseProps}
        sessions={[...sessions, joined]}
        onShare={onShare}
        joinState={{
          joinedKey: 'k9',
          joinedSessionName: 'j',
        }}
      />,
    )
    // Affected service (target name) and user (owner) surface in the banner.
    expect(screen.getByText('inventory')).toBeInTheDocument()
    expect(screen.getByText(/bob/)).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: /copy override link for k9/i,
      }),
    )
    expect(onShare).toHaveBeenCalledWith('k9')
  })

  test('stays live while a session still holds the joined key (survives reconnect)', () => {
    // The joined session id ("old") is gone, but another session reclaimed the
    // same key ("k1") — a stop → start reconnect. The banner must read live.
    render(
      <SessionsView
        {...baseProps}
        sessions={sessions}
        joinState={{ joinedKey: 'k1', joinedSessionName: 'old' }}
      />,
    )
    expect(screen.getByText(/session live/i)).toBeInTheDocument()
    expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument()
  })

  test('holds an amber waiting state, then ends after the grace period', () => {
    jest.useFakeTimers()
    try {
      render(
        <SessionsView
          {...baseProps}
          sessions={sessions}
          joinState={{ joinedKey: 'gone', joinedSessionName: 'x' }}
        />,
      )
      // No session holds key "gone": don't dismiss yet — wait it out.
      expect(screen.getByText(/waiting for session/i)).toBeInTheDocument()
      expect(screen.queryByText(/session ended/i)).not.toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(60_000)
      })

      expect(screen.getByText(/session ended/i)).toBeInTheDocument()
    } finally {
      jest.useRealTimers()
    }
  })

  test('renders the not-configured prompt when sessions have not loaded', () => {
    render(<SessionsView {...baseProps} sessions={[]} sessionsLoaded={false} />)
    expect(screen.getByText(/not configured/i)).toBeInTheDocument()
    expect(screen.getByText('mirrord ui')).toBeInTheDocument()
  })

  test('renders the ui-detected prompt when mirrord ui is up but we have no token', () => {
    render(
      <SessionsView {...baseProps} sessions={[]} sessionsLoaded={false} uiDetectedNoToken={true} />,
    )
    expect(screen.getByText(/mirrord ui is running/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /open mirrord ui/i })
    expect(link).toHaveAttribute('href', 'http://127.0.0.1:59281')
    expect(screen.queryByText(/not configured/i)).not.toBeInTheDocument()
  })

  test('renders the auth-error prompt (not run-mirrord-ui) when authFailed', () => {
    render(
      <SessionsView
        {...baseProps}
        sessions={[]}
        sessionsLoaded={false}
        authFailed={true}
        backend="http://127.0.0.1:8080"
      />,
    )
    expect(screen.getByText(/token rejected/i)).toBeInTheDocument()
    expect(screen.getByText('127.0.0.1:8080')).toBeInTheDocument()
    expect(screen.queryByText(/not configured/i)).not.toBeInTheDocument()
  })

  test('auth-error prompt falls back to the default mirrord ui port when backend is unknown', () => {
    render(
      <SessionsView
        {...baseProps}
        sessions={[]}
        sessionsLoaded={false}
        authFailed={true}
        backend={null}
      />,
    )
    expect(screen.getByText('127.0.0.1:59281')).toBeInTheDocument()
  })

  test('renders empty-state text when sessions are loaded but list is empty', () => {
    render(<SessionsView {...baseProps} sessions={[]} sessionsLoaded={true} />)
    expect(screen.getByText(/no active sessions/i)).toBeInTheDocument()
  })

  test('renders the operator-unavailable note when watch_status is unavailable', () => {
    render(
      <SessionsView
        {...baseProps}
        sessions={[]}
        sessionsLoaded={true}
        status={{
          status: 'unavailable',
          reason: 'no operator',
        }}
      />,
    )
    expect(screen.getByText(/showing local sessions only/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /install the operator/i })).toBeInTheDocument()
  })
})
