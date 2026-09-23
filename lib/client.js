window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-peak-status",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		var React = require("react");
		var react_jsx_runtime = require("react/jsx-runtime");
		const inject = ['slots'];
		const PEAK_WINDOWS = [
		    [9 * 60, 12 * 60],
		    [14 * 60, 18 * 60],
		];
		const TIME_ZONE = 'Asia/Shanghai';
		function beijingDayStart(date) {
		    const parts = new Intl.DateTimeFormat('en-CA', {
		        timeZone: TIME_ZONE,
		        year: 'numeric',
		        month: '2-digit',
		        day: '2-digit',
		    }).formatToParts(date);
		    const get = (type) => parts.find((p) => p.type === type)?.value ?? '0';
		    return new Date(Number(get('year')), Number(get('month')) - 1, Number(get('day')), 0, 0, 0, 0);
		}
		function beijingMinutes(date) {
		    const parts = new Intl.DateTimeFormat('en-GB', {
		        timeZone: TIME_ZONE,
		        hour: '2-digit',
		        minute: '2-digit',
		        hourCycle: 'h23',
		    }).formatToParts(date);
		    const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? '0');
		    return get('hour') * 60 + get('minute');
		}
		function currentSlot(now) {
		    const beijingDate = new Intl.DateTimeFormat('en-US', {
		        timeZone: TIME_ZONE,
		        weekday: 'short',
		    }).format(now);
		    if (beijingDate === 'Sat' || beijingDate === 'Sun') {
		        const dayStart = beijingDayStart(now);
		        let daysToAdd = 1;
		        let candidate = new Date(dayStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000);
		        while (true) {
		            const weekday = new Intl.DateTimeFormat('en-US', {
		                timeZone: TIME_ZONE,
		                weekday: 'short',
		            }).format(candidate);
		            if (weekday !== 'Sat' && weekday !== 'Sun')
		                break;
		            daysToAdd += 1;
		            candidate = new Date(dayStart.getTime() + daysToAdd * 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000);
		        }
		        return { kind: 'idle', label: '空闲', end: candidate };
		    }
		    const minutes = beijingMinutes(now);
		    for (const [start, end] of PEAK_WINDOWS) {
		        if (minutes >= start && minutes < end) {
		            return { kind: 'peak', label: '高峰', end: new Date(beijingDayStart(now).getTime() + end * 60_000) };
		        }
		    }
		    const dayStart = beijingDayStart(now);
		    let next = null;
		    for (const [start] of PEAK_WINDOWS) {
		        const candidate = new Date(dayStart.getTime() + start * 60_000);
		        if (candidate.getTime() > now.getTime()) {
		            next = candidate;
		            break;
		        }
		    }
		    if (next === null) {
		        next = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 + PEAK_WINDOWS[0][0] * 60_000);
		    }
		    return { kind: 'idle', label: '空闲', end: next };
		}
		function formatClock(date) {
		    const parts = new Intl.DateTimeFormat('en-GB', {
		        timeZone: TIME_ZONE,
		        hour: '2-digit',
		        minute: '2-digit',
		        second: '2-digit',
		        hourCycle: 'h23',
		    }).formatToParts(date);
		    const get = (type) => parts.find((p) => p.type === type)?.value ?? '00';
		    return `${get('hour')}:${get('minute')}:${get('second')}`;
		}
		function formatRemaining(ms) {
		    const total = Math.max(0, Math.floor(ms / 1000));
		    const hours = Math.floor(total / 3600);
		    const minutes = Math.floor((total % 3600) / 60);
		    const seconds = total % 60;
		    const pad = (n) => String(n).padStart(2, '0');
		    if (hours > 0)
		        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
		    return `${pad(minutes)}:${pad(seconds)}`;
		}
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
		`;
		function PeakStatusDock(_props) {
		    const [now, setNow] = React.useState(() => new Date());
		    React.useEffect(() => {
		        const timer = window.setInterval(() => { setNow(new Date()); }, 1000);
		        return () => { window.clearInterval(timer); };
		    }, []);
		    const slot = currentSlot(now);
		    return (React.createElement("div", { className: "dsh-peak-status", "data-dsh-peak-status": "" },
		        React.createElement("span", { className: `dsh-peak-status__dot dsh-peak-status__dot--${slot.kind}` }),
		        React.createElement("span", { className: `dsh-peak-status__label dsh-peak-status__label--${slot.kind}` }, slot.label),
		        React.createElement("span", { className: "dsh-peak-status__clock" }, formatClock(now)),
		        React.createElement("span", { className: "dsh-peak-status__sep" }, "\u00B7"),
		        React.createElement("span", null, '剩余 ' + formatRemaining(slot.end.getTime() - now.getTime()))));
		}
		function apply(ctx) {
		    ctx.effect(() => {
		        const style = document.createElement('style');
		        style.textContent = styles;
		        style.dataset.plugin = '@dsh-external/dsh-peak-status';
		        style.dataset.pluginCss = '@dsh-external/dsh-peak-status/PeakStatus.module.css';
		        document.head.appendChild(style);
		        const disposeSlot = ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
		            name: 'conversation.input.left',
		            id: 'dsh-peak-status',
		            order: 100,
		            label: () => '峰谷时段',
		        }, PeakStatusDock));
		        return () => {
		            style.remove();
		            disposeSlot();
		        };
		    }, '@dsh-external/dsh-peak-status: input left');
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

