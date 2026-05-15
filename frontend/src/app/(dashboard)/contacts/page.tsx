import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function ContactsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Contactos</CardTitle>
        <CardDescription>Gestión de compradores, vendedores e inversores.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Placeholder de contactos.</p>
      </CardContent>
    </Card>
  )
}
