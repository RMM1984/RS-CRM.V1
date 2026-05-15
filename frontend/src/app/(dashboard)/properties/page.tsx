import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PropertiesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Propiedades</CardTitle>
        <CardDescription>Inventario y captaciones activas.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Placeholder de propiedades.</p>
      </CardContent>
    </Card>
  )
}
