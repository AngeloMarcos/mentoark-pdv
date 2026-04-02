import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";

interface StepWelcomeProps {
  onNext: () => void;
}

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-lg mx-auto space-y-8 py-8">
      <div className="w-24 h-24 bg-primary/10 rounded-3xl flex items-center justify-center">
        <Rocket className="w-12 h-12 text-primary" />
      </div>

      <div className="space-y-3">
        <h2 className="text-3xl font-bold text-foreground">
          Bem-vindo ao Nexus Retail Cloud! 🎉
        </h2>
        <p className="text-lg text-muted-foreground">
          Vamos configurar seu sistema em poucos minutos.
        </p>
      </div>

      <p className="text-muted-foreground leading-relaxed">
        Responda algumas perguntas para personalizarmos o PDV para o seu
        negócio. Isso leva menos de 2 minutos.
      </p>

      <Button size="lg" className="text-base px-8 h-12" onClick={onNext}>
        Vamos começar →
      </Button>
    </div>
  );
}
