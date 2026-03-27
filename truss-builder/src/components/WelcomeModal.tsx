import {
  IconCircleDot,
  IconLine,
  IconTriangleSupport,
  IconArrowDown,
  IconBarChart,
  IconX,
} from './icons'

const STEPS: { icon: React.ReactNode; title: string; desc: string }[] = [
  {
    icon: <IconCircleDot className="h-4 w-4" />,
    title: 'Place Joints',
    desc: 'Click the canvas to add joints at any position',
  },
  {
    icon: <IconLine className="h-4 w-4" />,
    title: 'Connect Members',
    desc: 'Link joints together to form structural members',
  },
  {
    icon: <IconTriangleSupport className="h-4 w-4" />,
    title: 'Add Supports',
    desc: 'Assign pin and roller supports to grounded joints',
  },
  {
    icon: <IconArrowDown className="h-4 w-4" />,
    title: 'Apply Loads',
    desc: 'Set vertical forces on joints to simulate loading',
  },
  {
    icon: <IconBarChart className="h-4 w-4" />,
    title: 'Check Results',
    desc: 'View member forces, constraint status, and cost',
  },
]

export function WelcomeModal({
  onStartPreset,
  onSkip,
}: {
  onStartPreset: () => void
  onSkip: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden">

        {/* Top accent bar */}
        <div className="h-1 w-full bg-indigo-600" />

        <div className="p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100">
                <IconTriangleSupport className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 leading-tight">
                  Welcome to Truss Builder
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Design · Analyze · Cost
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors [touch-action:manipulation]"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>

          {/* Steps */}
          <div className="space-y-1.5">
            {STEPS.map((step, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  {step.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-700 leading-tight">{step.title}</div>
                  <div className="text-[11px] text-slate-400 leading-tight mt-0.5">{step.desc}</div>
                </div>
                <div className="ml-auto text-[11px] font-bold text-slate-200 shrink-0">{i + 1}</div>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={onStartPreset}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors [touch-action:manipulation]"
            >
              Start with a Preset Truss
              <span className="opacity-75">→</span>
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 transition-colors [touch-action:manipulation]"
            >
              Skip — I'll build from scratch
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
