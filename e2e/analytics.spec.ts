import { test, expect } from './fixtures'
import { addHeader } from './helpers'
import type { BrowserContext, Page } from '@playwright/test'

interface CapturedEvent {
  event: string
  properties: Record<string, unknown>
}

interface AnalyticsPayload {
  event: string
  properties?: Record<string, unknown>
}

interface CapturedAnalyticsWindow extends Window {
  __captured_analytics__?: CapturedEvent[]
}

/**
 * Instrument a page to capture analytics events by wrapping fetch().
 *
 * The analytics module sends events via fetch() to hog.metalbear.com/capture/.
 * We intercept those calls with addInitScript to record the event payloads
 * before they hit the network.
 */
async function setupAnalyticsSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const analyticsWindow = window as CapturedAnalyticsWindow
    const captured: CapturedEvent[] = []
    analyticsWindow.__captured_analytics__ = captured

    const recordPayload = (raw: string): void => {
      const payload = JSON.parse(raw) as AnalyticsPayload
      captured.push({
        event: payload.event,
        properties: payload.properties ?? {},
      })
    }

    const origFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      try {
        let url: string
        if (typeof input === 'string') {
          url = input
        } else if (input instanceof URL) {
          url = input.href
        } else {
          url = input.url
        }
        const body = init?.body
        if (url.includes('/capture/') && typeof body === 'string') {
          recordPayload(body)
        }
      } catch {
        // Don't break anything
      }
      return origFetch(input, init)
    }

    const origBeacon = navigator.sendBeacon.bind(navigator)
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null): boolean => {
      try {
        const urlStr = typeof url === 'string' ? url : url.href
        if (urlStr.includes('/capture/') && typeof data === 'string') {
          recordPayload(data)
        }
      } catch {
        // Don't break anything
      }
      return origBeacon(url, data)
    }
  })
}

async function getCapturedEvents(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const analyticsWindow = window as CapturedAnalyticsWindow
    const events = analyticsWindow.__captured_analytics__ ?? []
    return events.map((e) => e.event)
  })
}

async function openPopupWithSpy(context: BrowserContext, extensionId: string): Promise<Page> {
  const page = await context.newPage()
  await setupAnalyticsSpy(page)
  await page.goto(`chrome-extension://${extensionId}/pages/popup.html`)
  await page.evaluate(() =>
    chrome.storage.local.set({
      defaults: { headerName: '', headerValue: '', scope: '' },
    }),
  )
  await page.reload()
  return page
}

test.describe('Analytics events', () => {
  test('popup open sends extension_popup_opened event', async ({ context, extensionId }) => {
    const page = await openPopupWithSpy(context, extensionId)
    await expect(page.getByText('mirrord', { exact: true })).toBeVisible()

    const events = await getCapturedEvents(page)
    expect(events).toContain('extension_popup_opened')
  })

  test('saving a header rule sends extension_header_rule_saved event', async ({
    context,
    extensionId,
  }) => {
    const page = await openPopupWithSpy(context, extensionId)
    await expect(page.getByText('Inactive')).toBeVisible()

    await addHeader(page, 'X-Analytics-Test', 'analytics-value')

    const events = await getCapturedEvents(page)
    expect(events).toContain('extension_header_rule_saved')
  })

  test('removing a header rule sends extension_header_rule_removed event', async ({
    context,
    extensionId,
  }) => {
    const page = await openPopupWithSpy(context, extensionId)
    await expect(page.getByText('Inactive')).toBeVisible()

    await addHeader(page, 'X-Remove-Analytics', 'remove-me')
    await page.getByLabel('Toggle header injection').click()
    await expect(page.getByText('Inactive')).toBeVisible()

    const events = await getCapturedEvents(page)
    expect(events).toContain('extension_header_rule_removed')
  })
})
