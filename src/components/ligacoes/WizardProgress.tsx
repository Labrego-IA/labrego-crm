'use client'

import { CheckIcon } from '@heroicons/react/24/solid'

const PHASES = [
  { number: 1, label: 'Identidade' },
  { number: 2, label: 'Negócio' },
  { number: 3, label: 'Abertura' },
  { number: 4, label: 'Investigação' },
  { number: 5, label: 'Proposta' },
  { number: 6, label: 'Objeções' },
  { number: 7, label: 'Regras' },
]

function getStrengthConfig(score: number): { label: string; colorClass: string } {
  if (score >= 86) return { label: 'Agente forte', colorClass: 'bg-emerald-100 text-emerald-700' }
  if (score >= 61) return { label: 'Agente bom', colorClass: 'bg-blue-100 text-blue-700' }
  if (score >= 31) return { label: 'Agente razoável', colorClass: 'bg-amber-100 text-amber-700' }
  return { label: 'Agente fraco', colorClass: 'bg-red-100 text-red-700' }
}

interface WizardProgressProps {
  currentPhase: number
  completedPhases: number[]
  strengthScore?: number
}

export default function WizardProgress({ currentPhase, completedPhases, strengthScore = 0 }: WizardProgressProps) {
  const config = getStrengthConfig(strengthScore)

  return (
    <div className="w-full">
      {/* Strength badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">Progresso do Agente</span>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${config.colorClass}`}>
          {strengthScore}% — {config.label}
        </span>
      </div>

      <div className="flex items-center justify-between">
        {PHASES.map((phase, index) => {
          const isCompleted = completedPhases.includes(phase.number)
          const isCurrent = currentPhase === phase.number
          const isLast = index === PHASES.length - 1

          return (
            <div key={phase.number} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                    ${isCompleted
                      ? 'bg-primary text-white shadow-md shadow-primary/30'
                      : isCurrent
                        ? 'bg-primary/15 text-primary ring-2 ring-primary'
                        : 'bg-neutral-100 text-neutral-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <CheckIcon className="w-4 h-4" />
                  ) : (
                    phase.number
                  )}
                </div>
                <span
                  className={`
                    mt-1.5 text-[10px] font-medium whitespace-nowrap hidden sm:block
                    ${isCompleted ? 'text-primary' : isCurrent ? 'text-primary' : 'text-neutral-400'}
                  `}
                >
                  {phase.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="flex-1 mx-2 h-0.5 rounded-full">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-primary' : 'bg-neutral-200'
                    }`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
