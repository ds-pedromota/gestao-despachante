import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getServiceConfig } from "@/lib/helpers";

export default function ServiceBadge({ name, size = "default", className }) {
  const config = getServiceConfig(name);
  const displayName = name || "Não Informado";

  const sizeClasses = {
    sm: "p-1",
    default: "p-1.5",
    lg: "p-2"
  };

  return (
    <Badge 
      className={cn(
        "font-normal shadow-sm border hover:bg-opacity-80 transition-colors rounded-md",
        config.color, // Aplica a cor específica do serviço
        sizeClasses[size],
        className
      )}
      title={displayName}
    >
      <span className={cn("leading-none", size === "sm" ? "text-sm" : "text-lg")}>{config.emoji}</span>
    </Badge>
  );
}