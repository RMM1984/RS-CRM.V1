import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  CreateOperationDto,
  KanbanData,
  Operation,
  OperationFilters,
  OperationStage,
  UpdateOperationDto
} from '@/types/operations'

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

const cleanFilters = (filters: OperationFilters) => ({
  ...filters,
  type: filters.type === 'all' ? undefined : filters.type,
  stage: filters.stage === 'all' ? undefined : filters.stage,
  agent_id: filters.agent_id === 'all' ? undefined : filters.agent_id
})

export const useKanban = (filters: OperationFilters) =>
  useQuery({
    queryKey: ['operations', 'kanban', filters],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<KanbanData>>('/api/operations/kanban', {
        params: cleanFilters(filters)
      })

      return unwrap(response.data)
    }
  })

export const useOperations = (filters: OperationFilters) =>
  useQuery({
    queryKey: ['operations', 'list', filters],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<Operation[]>>('/api/operations', {
        params: cleanFilters(filters)
      })

      return unwrap(response.data)
    }
  })

export const useCreateOperation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateOperationDto) => {
      const response = await api.post<SuccessResponse<Operation>>('/api/operations', payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
    }
  })
}

export const useUpdateOperation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateOperationDto }) => {
      const response = await api.put<SuccessResponse<Operation>>(`/api/operations/${id}`, payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
    }
  })
}

export const useUpdateStage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: OperationStage }) => {
      const response = await api.put<SuccessResponse<Operation>>(`/api/operations/${id}`, { stage })

      return unwrap(response.data)
    },
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['operations'] })
      const previous = queryClient.getQueriesData<KanbanData | Operation[]>({ queryKey: ['operations'] })

      previous.forEach(([key, data]) => {
        if (!data) return

        if (Array.isArray(data)) {
          queryClient.setQueryData<Operation[]>(
            key,
            data.map((operation) => (operation.id === id ? { ...operation, stage } : operation))
          )
          return
        }

        const moving = Object.values(data).flat().find((operation) => operation.id === id)
        if (!moving) return

        const next = Object.entries(data).reduce<KanbanData>((kanban, [currentStage, operations]) => {
          kanban[currentStage as OperationStage] = operations.filter((operation) => operation.id !== id)
          return kanban
        }, { lead: [], visit: [], offer: [], contract: [], closed: [], lost: [] })

        next[stage] = [{ ...moving, stage }, ...next[stage]]
        queryClient.setQueryData<KanbanData>(key, next)
      })

      return { previous }
    },
    onError: (_err, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
    }
  })
}

export const useDeleteOperation = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<SuccessResponse<{ id: string }>>(`/api/operations/${id}`)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['operations'] })
    }
  })
}
