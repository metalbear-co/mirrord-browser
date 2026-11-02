import { Info } from 'lucide-react';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';

const OPERATOR_INSTALL_URL =
    'https://app.metalbear.com/?utm_source=install-operator-note&utm_medium=browser-extension';

/**
 * True when the `mirrord ui` server could not build a kube client because the user's kubeconfig
 * credentials are unusable (e.g. an exec plugin like `gke-gcloud-auth-plugin` failing), as opposed
 * to the operator simply not being installed.
 */
export function isKubeAuthFailure(reason: string | undefined): boolean {
    if (!reason) return false;
    return /auth error|auth exec|ExecCredential|reauthentication|unauthorized|\b401\b|token has expired|expired/i.test(
        reason
    );
}

export function OperatorUnavailableNote({ reason }: { reason?: string }) {
    const authFailed = isKubeAuthFailure(reason);
    return (
        <div
            className="flex items-start gap-2"
            style={{
                padding: '8px 10px',
                borderRadius: 6,
                background: COLORS.primary.bgSoft,
                border: `1px solid ${COLORS.primary.borderSubtle}`,
            }}
        >
            <Info
                style={{
                    height: 12,
                    width: 12,
                    marginTop: 2,
                    color: COLORS.brand.lilac,
                    flexShrink: 0,
                }}
            />
            <p
                className="text-muted-foreground"
                style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}
            >
                {authFailed ? (
                    <>
                        {STRINGS.MSG_KUBE_AUTH_EXPIRED}{' '}
                        {STRINGS.MSG_KUBE_AUTH_EXPIRED_HINT}
                    </>
                ) : (
                    <>
                        {STRINGS.MSG_LOCAL_SESSIONS_ONLY}{' '}
                        <a
                            href={OPERATOR_INSTALL_URL}
                            target="_blank"
                            rel="noreferrer"
                            style={{
                                color: COLORS.brand.lilac,
                                textDecoration: 'underline',
                            }}
                        >
                            {STRINGS.MSG_INSTALL_OPERATOR}
                        </a>{' '}
                        {STRINGS.MSG_INSTALL_OPERATOR_TO_VIEW_REMOTE}
                    </>
                )}
            </p>
        </div>
    );
}
