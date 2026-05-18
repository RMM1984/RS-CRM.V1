import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  CalendarUrlData,
  CalendarVisits,
  CreateVisitDto,
  UpdateVisitDto,
  Visit,
  VisitFilters,
  VisitsPageData
} from '@/types/visits'

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

const cleanFilters = (filters: VisitFilters) => ({
  ...filters,
  status: filters.status === 'all' ? undefined : filters.status
})

export const useVisits = (filters: VisitFilters) =>
  useQuery({
    queryKey: ['visits', filters],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<VisitsPageData>>('/api/visits', {
        params: cleanFilters(filters)
      })

      return unwrap(response.data)
    }
  })

export const useCalendarVisits = (params: { week_start?: string; year?: number; month?: number }) =>
  useQuery({
    queryKey: ['visits', 'calendar', params],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<CalendarVisits>>('/api/visits/calendar', {
        params
      })

      return unwrap(response.data)
    }
  })

export const useCreateVisit = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateVisitDto) => {
      const response = await api.post<SuccessResponse<Visit>>('/api/visits', payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

export const useUpdateVisit = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateVisitDto }) => {
      const response = await api.put<SuccessResponse<Visit>>(`/api/visits/${id}`, payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

export const useDeleteVisit = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<SuccessResponse<Visit>>(`/api/visits/${id}`)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['visits'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
  })
}

export const useCalendarUrl = () =>
  useQuery({
    enabled: false,
    queryKey: ['visits', 'calendar-url'],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<CalendarUrlData>>('/api/calendar/my-url')

      return unwrap(response.data)
    }
  })
