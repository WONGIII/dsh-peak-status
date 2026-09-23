/**
 * dsh-peak-status — a Beijing-time peak/idle indicator for the DSH input bar.
 *
 * Renders one lightweight status row on the left side of the composer
 * (`conversation.input.left`, the same bar the send button sits on):
 *
 *   ● 高峰 14:23:45 · 剩余 03:36:15
 *   ● 空闲 12:30:01 · 剩余 01:29:59
 *
 * Peak windows are defined in Beijing time (UTC+8). Weekends count as idle for
 * the whole day, matching the DeepSeek off-peak discount schedule.
 *
 * This module is the *browser half* of a DSH client plugin: the host half
 * (`lib/index.js`) is an empty `apply` that exists only so the package holds a
 * Loader row, which is what `dsh-client-modules` actually serves to the page.
 */
export const inject = ['slots']

/** Peak windows as minutes since Beijing midnight: 09:00–12:00 and 14:00–18:00. */
const PEAK_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

const TIME_ZONE = 'Asia/Shanghai'

/** Midnight of the current Beijing day, as a local-time `Date` on that calendar date. */
function beijingDayStart(date: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '0'
  return new Date(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 0, 0, 0, 0)
}

/** Minutes since Beijing midnight, 0–1439. */
function beijingMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? '0')
  return get('hour') * 60 + get('minute')
}

interface SlotInfo {
  kind: 'peak' | 'idle'
  label: string
  /** Instant the current window ends, or the next peak begins while idle. */
  end: Date
}

/** Classify one instant and resolve the window boundary the countdown targets. */
function currentSlot(now: Date): SlotInfo {
  const beijingDate = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    weekday: 'short',
  }).format(now)
  // Weekends are idle all day; the next peak is Monday 09:00.
  if (beijingDate === 'Sat' || beijingDate === 'Sun') {
    const dayStart = beijingDayStart(now)
    // Saturday rolls to Monday; Sunday rolls to Monday. Walk forward until the
    // candidate lands on a weekday so the countdown never targets a weekend.
    let daysToAdd = 1
    let candidate = new Date(dayStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000)
    while (true) {
      const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        weekday: 'short',
      }).format(candidate)
      if (weekday !== 'Sat' && weekday !== 'Sun') break
      daysToAdd += 1
      candidate = new Date(dayStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000)
    }
    return { kind: 'idle', label: '空闲', end: candidate }
  }

  const minutes = beijingMinutes(now)
  for (const [start, end] of PEAK_WINDOWS) {
    if (minutes >= start && minutes < end) {
      return { kind: 'peak', label: '高峰', end: new Date(beijingDayStart(now).getTime() + end * 60_000) }
    }
  }
  const dayStart = beijingDayStart(now)
  let next: Date | null = null
  for (const [start] of PEAK_WINDOWS) {
    const candidate = new Date(dayStart.getTime() + start * 60_000)
    if (candidate.getTime() > now.getTime()) {
      next = candidate
      break
    }
  }
  if (next === null) {
    next = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000)
  }
  return { kind: 'idle', label: '空闲', end: next }
}

/** Beijing wall clock as `HH:MM:SS`. */
function formatClock(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const get = (type: string): string =>
    parts.find((p) => p.type === type)?.value ?? '00'
  return `${get('hour')}:${get('minute')}:${get('second')}`
}

/** Countdown text: `HH:MM:SS` above an hour, `MM:SS` below it. */
function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return `${pad(minutes)}:${pad(seconds)}`
}

/** Injected once per load; themed through `--dsw-alias-*` tokens with fallbacks. */
const styles = `
.dsh-peak-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: max-content;
  max-width: 100%;
  box-sizing: border-box;
  height: 24px;
  margin: 0;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2, #333);
  border-radius: 999px;
  background: var(--dsw-alias-bg-base, #161616);
  color: var(--dsw-alias-label-tertiary, #888);
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}
.dsh-peak-status__dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.dsh-peak-status__dot--peak {
  background: #f87171;
}
.dsh-peak-status__dot--idle {
  background: #34d399;
}
.dsh-peak-status__label {
  font-weight: 500;
}
.dsh-peak-status__label--peak {
  color: #f87171;
}
.dsh-peak-status__label--idle {
  color: #34d399;
}
.dsh-peak-status__sep {
  color: var(--dsw-alias-separator-primary, #444);
  margin: 0 2px;
}
`

/** The status row itself; re-renders once a second while the input bar is mounted. */
function PeakStatusDock(_props: Record<string, never>): JSX.Element {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const timer = window.setInterval(() => { setNow(new Date()) }, 1000)
    return () => { window.clearInterval(timer) }
  }, [])
  const slot = currentSlot(now)
  return (
    <div className="dsh-peak-status" data-dsh-peak-status="">
      <span className={`dsh-peak-status__dot dsh-peak-status__dot--${slot.kind}`} />
      <span className={`dsh-peak-status__label dsh-peak-status__label--${slot.kind}`}>{slot.label}</span>
      <span className="dsh-peak-status__clock">{formatClock(now)}</span>
      <span className="dsh-peak-status__sep">·</span>
      <span>{'剩余 ' + formatRemaining(slot.end.getTime() - now.getTime())}</span>
    </div>
  )
}

/**
 * Mount the plugin: install the stylesheet and wait for the composer's left
 * slot, then contribute the status row.
 *
 * `ctx.effect` ties both artifacts to the plugin fiber, and `slots.inject`
 * re-runs its callback whenever the slot is declared or collapsed, so an
 * unload (or the Plugins page switch) removes the row and its stylesheet.
 */
export function apply(ctx: DshPluginContext): void {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.textContent = styles
    style.dataset.plugin = '@dsh-external/dsh-peak-status'
    style.dataset.pluginCss = '@dsh-external/dsh-peak-status/PeakStatus.module.css'
    document.head.appendChild(style)
    const disposeSlot = ctx.slots.inject('conversation.input.left', () =>
      ctx.slots.register(
        {
          name: 'conversation.input.left',
          id: 'dsh-peak-status',
          order: 100,
          label: () => '峰谷时段',
        },
        PeakStatusDock,
      ),
    )
    return () => {
      style.remove()
      disposeSlot()
    }
  }, '@dsh-external/dsh-peak-status: input left')
}
