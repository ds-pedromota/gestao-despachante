import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Snowflake } from "lucide-react";

const STATUS_CONFIG = {
  pendente: {
    label: "Pendente",
    color: "bg-red-500 text-white border-red-600",
    lightColor: "bg-red-50 text-red-700 border-red-200",
    emoji: "⏳"
  },
  aprovado: {
    label: "Aprovado",
    color: "bg-green-500 text-white border-green-600",
    lightColor: "bg-green-50 text-green-700 border-green-200",
    emoji: "💰"
  },
  em_andamento: {
    label: "Em Andamento",
    color: "bg-teal-500 text-white border-teal-600",
    lightColor: "bg-teal-50 text-teal-700 border-teal-200",
    emoji: "🚶‍♂️"
  },
  concluido: {
    label: "Concluído",
    color: "bg-blue-600 text-white border-blue-700",
    lightColor: "bg-blue-50 text-blue-700 border-blue-200",
    emoji: "✔️"
  },
  congelado: {
    label: "Congelado",
    color: "bg-sky-400 text-white border-sky-500",
    lightColor: "bg-sky-50 text-sky-700 border-sky-200",
    emoji: "🐧"
  },
  arquivado: {
    label: "Arquivado",
    color: "bg-gray-500 text-white border-gray-600",
    lightColor: "bg-gray-50 text-gray-700 border-gray-200",
    emoji: "🗄️"
  }
};

export default function StatusBadge({ status, variant = "default", size = "default", showIcon = true }) { // showIcon mantido para compatibilidade, mas usaremos emoji
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;

  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    default: "text-sm px-3 py-1",
    lg: "text-base px-4 py-1.5"
  };

  return (
    <Badge 
      className={cn(
        "font-medium border transition-all",
        variant === "light" ? config.lightColor : config.color,
        sizeClasses[size]
      )}
    >
      {showIcon && <span className={cn("mr-1.5", size === "sm" ? "text-xs" : "text-sm")}>{config.emoji}</span>}
      {config.label}
    </Badge>
  );
}