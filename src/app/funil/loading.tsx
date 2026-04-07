import Skeleton from '@/components/shared/Skeleton'

export default function FunilLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton variant="text" className="w-48 h-8" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Skeleton variant="card" count={3} />
      </div>
    </div>
  )
}
