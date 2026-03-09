import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function StatusChart({ data }) {
  // Transforma o objeto de stats em array para o Recharts
  const chartData = [
    {
      name: 'Pendentes',
      quantidade: data?.pendentes?.count || 0,
      valor: data?.pendentes?.total || 0,
      color: '#ef4444' // Red
    },
    {
      name: 'Aprovados',
      quantidade: data?.aprovados?.count || 0,
      valor: data?.aprovados?.total || 0,
      color: '#22c55e' // Green
    },
    {
      name: 'Em Andamento',
      quantidade: data?.emAndamento?.count || 0,
      valor: data?.emAndamento?.total || 0,
      color: '#14b8a6' // Tiffany (Teal)
    }
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg text-sm z-50">
          <p className="font-bold text-slate-800 mb-1">{label}</p>
          <p className="text-slate-600">
            Quantidade: <span className="font-semibold">{item.quantidade}</span>
          </p>
          {item.valor > 0 && (
            <p className="text-slate-600">
              Valor Total: <span className="font-semibold text-green-600">
                {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Visão Geral dos Serviços</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[350px] pl-0">
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#64748b', fontSize: 12 }} 
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9', radius: 4 }} />
              <Bar dataKey="quantidade" radius={[4, 4, 0, 0]} barSize={60}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}