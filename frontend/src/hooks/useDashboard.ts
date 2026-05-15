import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type { DashboardSummary } from '@/types/dashboard'

type SuccessResponse<T> =
  | ApiResponse<T>
  | {
      success: true
      data: T
    }

const unwrap = <T>(payload: SuccessResponse<T>): T => {
  if ('success' in payload) return payload.data
  if (payload.ok) return payload.data
  throw new Error(payload.error.message)
}

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<DashboardSummary>>('/api/dashboard/summary')

      return unwrap(response.data)
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 2 * 60 * 1000
  })
