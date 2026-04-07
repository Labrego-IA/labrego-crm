import Skeleton from '@/components/shared/Skeleton'

export default function ProjecaoLoading() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton variant="text" className="w-56 h-8" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Skeleton variant="card" count={4} />
      </div>
      <Skeleton variant="table-row" count={6} />
    </div>
  )
}
