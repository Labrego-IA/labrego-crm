export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export const ui = {
  btn: `inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 px-3.5 py-2 text-sm
        font-semibold text-primary bg-primary/10 hover:bg-primary/20 hover:border-primary/50 shadow-sm transition active:scale-[0.99]`,
  btnPrimary: `inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
        text-white bg-primary hover:bg-primary/80 shadow-sm transition active:scale-[0.99]`,
  btnDanger: `inline-flex items-center justify-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold
        text-white bg-error hover:bg-error/80 shadow-sm transition active:scale-[0.99]`,
  input: `w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800
        placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30`,
  textarea: `w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800
        placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-primary/20 focus:border-primary/30`,
  card: `bg-white rounded-3xl shadow-sm ring-1 ring-gray-200`,
  statPill: `inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600`,
  statPillPrimary: `inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary ring-1 ring-primary/30`,
  statGood: `inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success ring-1 ring-success/30`,
  statWarn: `inline-flex items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning ring-1 ring-warning/30`,
  statBad: `inline-flex items-center gap-1 rounded-full bg-error/10 px-2.5 py-1 text-[11px] font-semibold text-error ring-1 ring-error/30`,
}
