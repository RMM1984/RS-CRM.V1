import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  AddInteractionDto,
  Contact,
  ContactDetail,
  ContactFilters,
  ContactsPageData,
  CreateContactDto,
  Interaction,
  UpdateContactDto
} from '@/types/contacts'

type SuccessResponse<T> =
  | ApiResponse<T>
  | {
      success: true
      data: T
    }

type Agent = {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'agent'
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

const contactsKey = (filters: ContactFilters) => ['contacts', filters]
const contactKey = (id?: string | null) => ['contact', id]

export const useContacts = (filters: ContactFilters) =>
  useQuery({
    queryKey: contactsKey(filters),
    queryFn: async () => {
      const params = {
        ...filters,
        type: filters.type === 'todos' ? undefined : filters.type,
        status: filters.status === 'todos' ? undefined : filters.status
      }
      const response = await api.get<SuccessResponse<ContactsPageData>>('/api/contacts', {
        params
      })

      return unwrap(response.data)
    }
  })

export const useContact = (id?: string | null) =>
  useQuery({
    enabled: Boolean(id),
    queryKey: contactKey(id),
    queryFn: async () => {
      const response = await api.get<SuccessResponse<ContactDetail>>(`/api/contacts/${id}`)

      return unwrap(response.data)
    }
  })

export const useAgents = (enabled: boolean) =>
  useQuery({
    enabled,
    queryKey: ['agents'],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Agent[]>>('/api/users')

      return unwrap(response.data)
    }
  })

export const useCreateContact = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: CreateContactDto) => {
      const response = await api.post<SuccessResponse<Contact>>('/api/contacts', payload)

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    }
  })
}

export const useUpdateContact = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: UpdateContactDto }) => {
      const response = await api.put<SuccessResponse<Contact>>(`/api/contacts/${id}`, payload)

      return unwrap(response.data)
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(contactKey(contact.id), contact)
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    }
  })
}

export const useDeleteContact = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<SuccessResponse<Contact>>(`/api/contacts/${id}`)

      return unwrap(response.data)
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['contacts'] })
      const previous = queryClient.getQueriesData<ContactsPageData>({ queryKey: ['contacts'] })

      previous.forEach(([key, data]) => {
        if (!data) {
          return
        }

        queryClient.setQueryData<ContactsPageData>(key, {
          ...data,
          contacts: data.contacts.filter((contact) => contact.id !== id),
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
      void queryClient.invalidateQueries({ queryKey: ['contacts'] })
    }
  })
}

export const useAddInteraction = (contactId?: string | null) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AddInteractionDto) => {
      const response = await api.post<SuccessResponse<Interaction>>(
        `/api/contacts/${contactId}/interactions`,
        payload
      )

      return unwrap(response.data)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: contactKey(contactId) })
    }
  })
}
