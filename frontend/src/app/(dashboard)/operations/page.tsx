import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function OperationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Operaciones</CardTitle>
        <CardDescription>Pipeline comercial de ventas y alquileres.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Placeholder de operaciones.</p>
      </CardContent>
    </Card>
  )
}
