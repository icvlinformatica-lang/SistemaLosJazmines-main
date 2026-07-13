"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Pie,
  PieChart,
  Cell,
} from "recharts"
import { formatCurrency } from "@/lib/utils-financieros"

const PIE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export interface SerieItem {
  nombre: string
  total: number
}

/** Gráfico de barras: total gastado por período (día o mes). */
export function BarrasPorPeriodo({
  data,
  titulo,
  descripcion,
}: {
  data: SerieItem[]
  titulo: string
  descripcion?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descripcion ? <p className="text-xs text-muted-foreground">{descripcion}</p> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Sin datos para mostrar.</p>
        ) : (
          <ChartContainer
            config={{ total: { label: "Gastado", color: "var(--chart-4)" } }}
            className="h-[260px] w-full"
          >
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="nombre"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                fontSize={11}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                fontSize={11}
                tickFormatter={(v) => formatCurrency(Number(v))}
              />
              <ChartTooltip
                content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />}
              />
              <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

/** Gráfico circular: distribución del gasto por categoría o salón. */
export function CircularDistribucion({
  data,
  titulo,
  descripcion,
}: {
  data: SerieItem[]
  titulo: string
  descripcion?: string
}) {
  const config: Record<string, { label: string; color: string }> = {}
  data.forEach((d, i) => {
    config[`slice-${i}`] = { label: d.nombre, color: PIE_COLORS[i % PIE_COLORS.length] }
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
        {descripcion ? <p className="text-xs text-muted-foreground">{descripcion}</p> : null}
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">Sin datos para mostrar.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <ChartContainer config={config} className="h-[220px] w-full sm:w-1/2">
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(v) => formatCurrency(Number(v))} />}
                />
                <Pie data={data} dataKey="total" nameKey="nombre" innerRadius={50} strokeWidth={2}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <ul className="w-full sm:w-1/2 space-y-1.5">
              {data.map((d, i) => (
                <li key={d.nombre} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate">{d.nombre}</span>
                  </span>
                  <span className="font-medium text-foreground shrink-0">
                    {formatCurrency(d.total)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
