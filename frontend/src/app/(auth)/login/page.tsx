'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { AxiosError } from 'axios'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { setToken } from '@/lib/auth'
import type { ApiResponse } from '@/types/api'
import type { LoginResponse } from '@/types/auth'

const loginSchema = z.object({
  email: z.string().email('Introduce un email valido'),
  password: z.string().min(8, 'La password debe tener al menos 8 caracteres')
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  })

  const onSubmit = async (values: LoginForm) => {
    setErrorMessage(null)

    try {
      const response = await api.post<ApiResponse<LoginResponse>>('/api/auth/login', values)

      if (!response.data.ok) {
        setErrorMessage(response.data.error.message)
        return
      }

      setToken(response.data.data.token)
      router.replace('/dashboard')
    } catch (err) {
      if (err instanceof AxiosError) {
        const message = err.response?.data?.error?.message
        setErrorMessage(typeof message === 'string' ? message : 'No se pudo iniciar sesion')
        return
      }

      setErrorMessage('No se pudo iniciar sesion')
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-primary text-sm font-black text-primary-foreground">
            SK
          </div>
          <div>
            <CardTitle>SKOPI</CardTitle>
            <CardDescription>Acceso al CRM inmobiliario</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                autoComplete="email"
                id="email"
                placeholder="admin@empresa.com"
                type="email"
                {...register('email')}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                autoComplete="current-password"
                id="password"
                placeholder="Tu password"
                type="password"
                {...register('password')}
              />
              {errors.password ? (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              ) : null}
            </div>

            {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}

            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
