import Skeleton from '@/components/shared/Skeleton'

export default function CampanhasLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton variant="text" className="w-48 h-8" />
        <Skeleton variant="text" className="w-32 h-10" />
      </div>
      <Skeleton variant="table-row" count={6} />
    </div>
  )
}
