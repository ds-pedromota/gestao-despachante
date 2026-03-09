import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatsCard({ title, value, icon: Icon, color, subtitle }) {
  const colorClasses = {
    red: "bg-red-50 text-red-600 border-red-200",
    green: "bg-green-50 text-green-600 border-green-200",
    tiffany: "bg-teal-50 text-teal-600 border-teal-200",
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    gray: "bg-slate-50 text-slate-600 border-slate-200"
  };

  const iconBg = {
    red: "bg-red-100",
    green: "bg-green-100",
    tiffany: "bg-teal-100",
    blue: "bg-blue-100",
    gray: "bg-slate-100"
  };

  return (
    <Card className={cn("border-2 transition-all hover:shadow-lg", colorClasses[color])}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-80 uppercase tracking-wide">{title}</p>
            <p className="text-3xl font-bold mt-2">{value}</p>
            {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
          </div>
          <div className={cn("p-4 rounded-2xl", iconBg[color])}>
            <Icon className="w-7 h-7" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}