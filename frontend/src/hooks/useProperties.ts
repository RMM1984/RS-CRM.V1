import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  CreatePropertyDto,
  PropertiesPageData,
  Property,
  PropertyFilters,
  PropertyContactMatch,
  PropertySearchResult,
  SaveToShortlistDto,
  ShortlistItem,
  UpdatePropertyDto
} from '@/types/properties'

type SuccessResponse<T> =
  | ApiResponse<T>
  | {
      success: true
      data: T
    }

const unwrap = <T>(payload: SuccessResponse<T>): T => {
  if ('success' in payload) {
    return payload.data
  }

  if (payload.ok) {
    return payload.data
  }

  throw new Error(payload.error.message)
}

const typeFilterToCanonical: Record<string, string> = {
  apartment: 'apartment',
  apartment_loft: 'apartment',
  apartment_penthouse: 'apartment',
  village_house: 'village_house',
  townhouse: 'townhouse',
  bungalow: 'townhouse',
  villa: 'villa',
  land: 'land',
  commercial: 'commercial',
  garage: 'garage'
}

const cleanFilters = (filters: PropertyFilters) => {
  const search = filters.search?.trim()

  return {
    ...filters,
    operation: filters.operation === 'all' ? undefined : filters.operation,
    status: filters.status === 'all' ? undefined : filters.status,
    source: filters.source === 'all' ? undefined : filters.source,
    type: filters.type && filters.type !== 'all' ? typeFilterToCanonical[filters.type] ?? filters.type : undefined,
    search: search ? search : undefined
  }
}

export const useProperties = (filters: PropertyFilters) =>
  useQuery({
    queryKey: ['properties', filters],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<PropertiesPageData>>('/api/properties', {
        params: cleanFilters(filters)
      })

      return unwrap(response.data)
    }
  })

export const useProperty = (id?: string | null) =>
  useQuery({
    enabled: Boolean(id),
    queryKey: ['property', id],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<Property>>(`/api/properties/${id}`)

      return unwrap(response.data)
    }
  })

export const usePropertySearch = (query: string) =>
  useMutation({
    mutationFn: async (payload?: string | { query?: string; type?: string | null }) => {
      const body = typeof payload === 'string'
        ? { query: payload }
        : { query: payload?.query ?? query, type: payload?.type }
      const response = await api.post<SuccessResponse<PropertySearchResult>>('/api/properties/search', {
        ...body
      })

      return unwrap(response.data)
    }
  })

export const usePropertyMatches = (id?: string | null) =>
  useQuery({
    enabled: Boolean(id),
    queryKey: ['property', id, 'matches'],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<{ matches: PropertyContactMatch[] }>>(`/api/properties/${id}/matches`)

      return unwrap(response.data).matches
    }
  })

export const useCreateProperty = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreatePropertyDto) => {
      const response = await api.post<SuccessResponse<Property>>('/api/properties', payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['properties'] })
    }
  })
}

export const useUpdateProperty = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdatePropertyDto }) => {
      const response = await api.put<SuccessResponse<Property>>(`/api/properties/${id}`, payload)

      return unwrap(response.data)
    },
    onSuccess: (property) => {
      queryClient.setQueryData(['property', property.id], property)
      void queryClient.invalidateQueries({ queryKey: ['properties'] })
    }
  })
}

export const useDeleteProperty = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<SuccessResponse<Property>>(`/api/properties/${id}`)

      return unwrap(response.data)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['properties'] })
      const previous = queryClient.getQueriesData<PropertiesPageData>({ queryKey: ['properties'] })

      previous.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData<PropertiesPageData>(key, {
          ...data,
          properties: data.properties.filter((property) => property.id !== id),
          total: Math.max(0, data.total - 1)
        })
      })

      return { previous }
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['properties'] })
    }
  })
}

export const useUploadPropertyImage = (propertyId?: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }) => {
      const formData = new FormData()
      formData.append('file', file)

      const response = await api.post<SuccessResponse<unknown>>(`/api/properties/${propertyId}/images`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total && onProgress) {
            onProgress(Math.round((event.loaded * 100) / event.total))
          }
        }
      })

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['property', propertyId] })
    }
  })
}

export const useShortlist = (contactId?: string | null) =>
  useQuery({
    queryKey: ['shortlist', contactId ?? 'all'],
    queryFn: async () => {
      const response = await api.get<SuccessResponse<ShortlistItem[]>>('/api/shortlist', {
        params: contactId ? { contact_id: contactId } : undefined
      })

      return unwrap(response.data)
    }
  })

export const useSaveToShortlist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaveToShortlistDto) => {
      const response = await api.post<SuccessResponse<ShortlistItem>>('/api/shortlist', payload)

      return unwrap(response.data)
    },
    onSuccess: (item) => {
      void queryClient.invalidateQueries({ queryKey: ['shortlist'] })
      void queryClient.invalidateQueries({ queryKey: ['shortlist', item.contact_id ?? 'all'] })
    }
  })
}

export const useUpdateShortlistItem = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Pick<ShortlistItem, 'status'> | { notes: string } }) => {
      const response = await api.put<SuccessResponse<ShortlistItem>>(`/api/shortlist/${id}`, payload)

      return unwrap(response.data)
    },
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ['shortlist'] })
      const previous = queryClient.getQueriesData<ShortlistItem[]>({ queryKey: ['shortlist'] })

      previous.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData<ShortlistItem[]>(
          key,
          data.map((item) => (item.id === id ? { ...item, ...payload } : item))
        )
      })

      return { previous }
    },
    onError: (_err, _variables, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['shortlist'] })
    }
  })
}

export const useRemoveFromShortlist = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<SuccessResponse<{ id: string }>>(`/api/shortlist/${id}`)

      return unwrap(response.data)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['shortlist'] })
      const previous = queryClient.getQueriesData<ShortlistItem[]>({ queryKey: ['shortlist'] })

      previous.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData<ShortlistItem[]>(
          key,
          data.filter((item) => item.id !== id)
        )
      })

      return { previous }
    },
    onError: (_err, _id, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data)
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['shortlist'] })
    }
  })
}
