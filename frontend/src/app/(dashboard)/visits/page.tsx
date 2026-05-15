import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function VisitsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Visitas</CardTitle>
        <CardDescription>Agenda de visitas y seguimientos.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Placeholder de visitas.</p>
      </CardContent>
    </Card>
  )
}
