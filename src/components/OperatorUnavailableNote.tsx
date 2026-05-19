import { Info } from 'lucide-react';
import { STRINGS } from '../constants';
import { COLORS } from '../colors';

const OPERATOR_INSTALL_URL =
    'https://app.metalbear.com/?utm_source=install-operator-note&utm_medium=browser-extension';

export function OperatorUnavailableNote() {
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
            </p>
        </div>
    );
}
