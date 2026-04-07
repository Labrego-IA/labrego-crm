export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
        <span className="text-sm text-slate-400">Carregando...</span>
      </div>
    </div>
  )
}
