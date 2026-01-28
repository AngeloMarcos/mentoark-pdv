import { useMemo } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PasswordStrengthProps {
  password: string;
  showRequirements?: boolean;
}

interface Requirement {
  label: string;
  met: boolean;
}

export function PasswordStrength({ password, showRequirements = true }: PasswordStrengthProps) {
  const requirements = useMemo((): Requirement[] => {
    return [
      { label: "Mínimo 6 caracteres", met: password.length >= 6 },
      { label: "Letra maiúscula", met: /[A-Z]/.test(password) },
      { label: "Número", met: /[0-9]/.test(password) },
      { label: "Caractere especial", met: /[!@#$%^&*(),.?":{}|<>]/.test(password) },
      { label: "Mínimo 8 caracteres", met: password.length >= 8 },
    ];
  }, [password]);

  const metCount = requirements.filter((r) => r.met).length;
  
  const strength = useMemo(() => {
    if (metCount <= 2) return { level: "weak", label: "Fraca", color: "bg-destructive" };
    if (metCount <= 3) return { level: "medium", label: "Média", color: "bg-yellow-500" };
    return { level: "strong", label: "Forte", color: "bg-green-500" };
  }, [metCount]);

  const percentage = (metCount / requirements.length) * 100;

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn("h-full transition-all duration-300", strength.color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn(
          "text-xs font-medium",
          strength.level === "weak" && "text-destructive",
          strength.level === "medium" && "text-yellow-600",
          strength.level === "strong" && "text-green-600"
        )}>
          {strength.label}
        </span>
      </div>
      
      {showRequirements && (
        <ul className="grid grid-cols-2 gap-1 text-xs">
          {requirements.map((req, index) => (
            <li
              key={index}
              className={cn(
                "flex items-center gap-1",
                req.met ? "text-green-600" : "text-muted-foreground"
              )}
            >
              {req.met ? (
                <Check className="h-3 w-3" />
              ) : (
                <X className="h-3 w-3" />
              )}
              {req.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
