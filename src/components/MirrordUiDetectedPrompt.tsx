import { ExternalLink, Radio } from 'lucide-react';
import { Button, Card, CardContent } from '@metalbear/ui';
import { MIRRORD_UI_DEFAULT_BACKEND, STRINGS } from '../constants';
import { COLORS } from '../colors';

/**
 * Shown when the extension has no token but a `mirrord ui` server is answering on the default
 * port. Tells the user it's running and links to the page so they can get the extension
 * configured (or re-run `mirrord ui`) without hunting for the URL.
 */
export function MirrordUiDetectedPrompt() {
    return (
        <Card
            className="overflow-hidden"
            style={{
                borderColor: COLORS.primary.borderSubtle,
                background: COLORS.primary.bgSoft,
            }}
        >
            <CardContent
                style={{
                    padding: 16,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }}
            >
                <div className="flex items-center gap-2">
                    <Radio
                        style={{
                            height: 14,
                            width: 14,
                            color: COLORS.brand.lilac,
                        }}
                    />
                    <span
                        className="font-semibold text-foreground"
                        style={{
                            fontSize: 10.5,
                            letterSpacing: 'normal',
                            textTransform: 'none',
                        }}
                    >
                        {STRINGS.MSG_UI_DETECTED_TITLE}
                    </span>
                </div>
                <p
                    className="text-muted-foreground"
                    style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}
                >
                    {STRINGS.MSG_UI_DETECTED_HINT}
                </p>
                <Button asChild size="sm" className="w-full">
                    <a
                        href={MIRRORD_UI_DEFAULT_BACKEND}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5"
                    >
                        {STRINGS.BTN_OPEN_MIRRORD_UI}
                        <ExternalLink style={{ height: 12, width: 12 }} />
                    </a>
                </Button>
            </CardContent>
        </Card>
    );
}
