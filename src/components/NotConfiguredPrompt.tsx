import { Terminal } from 'lucide-react'
import { Card, CardContent } from '@metalbear/ui'
import { STRINGS } from '../constants'
import { COLORS } from '../colors'

export function NotConfiguredPrompt() {
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
          <Terminal
            style={{
              height: 14,
              width: 14,
              color: COLORS.brand.lilac,
            }}
          />
          <span
            className="text-foreground font-semibold"
            style={{
              fontSize: 10.5,
              letterSpacing: 'normal',
              textTransform: 'none',
            }}
          >
            {STRINGS.MSG_NOT_CONFIGURED}
          </span>
        </div>
        <div
          className="border-primary/30 bg-primary/10 rounded-md border"
          style={{
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            className="text-muted-foreground font-mono"
            style={{ fontSize: 12, userSelect: 'none' }}
          >
            {STRINGS.TERMINAL_PROMPT}
          </span>
          <code
            className="font-mono"
            style={{
              color: COLORS.brand.yellow,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {STRINGS.MSG_MIRRORD_UI_COMMAND}
          </code>
        </div>
        <p className="text-muted-foreground" style={{ fontSize: 11, lineHeight: 1.45, margin: 0 }}>
          {STRINGS.MSG_NOT_CONFIGURED_HINT}
        </p>
      </CardContent>
    </Card>
  )
}
