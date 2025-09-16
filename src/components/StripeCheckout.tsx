import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, Shield, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  billing_period: string;
  student_limit: number;
  features: string[];
}

interface StripeCheckoutProps {
  plan: SubscriptionPlan;
  trainerId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const StripeCheckout = ({ plan, trainerId, onSuccess, onCancel }: StripeCheckoutProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(cents / 100);
  };

  const getBillingPeriodLabel = (period: string) => {
    const labels = {
      trial: "30 dias grátis",
      monthly: "por mês",
      quarterly: "por trimestre",
      yearly: "por ano"
    };
    return labels[period as keyof typeof labels] || period;
  };

  const handleCheckout = async () => {
    setIsLoading(true);

    try {
      // Para planos de teste, criar assinatura diretamente
      if (plan.billing_period === 'trial') {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 30);

        // First cancel any existing active subscriptions
        await supabase
          .from("subscriptions")
          .update({ status: 'canceled' })
          .eq("personal_trainer_id", trainerId)
          .eq("status", "active");

        const { error } = await supabase
          .from("subscriptions")
          .insert({
            personal_trainer_id: trainerId,
            subscription_plan_id: plan.id,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: endDate.toISOString(),
            students_count: 0
          });

        if (error) throw error;

        toast({
          title: "Plano ativado!",
          description: "Seu plano foi ativado com sucesso por 30 dias.",
        });

        onSuccess();
        return;
      }

      // Para planos pagos, mostrar mensagem para contatar administrador
      toast({
        title: "Contate o administrador",
        description: "Para planos pagos, entre em contato com o administrador do sistema.",
        variant: "default",
      });

      onCancel();

    } catch (error) {
      console.error("Error processing checkout:", error);
      toast({
        title: "Erro",
        description: "Erro ao ativar plano. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <CreditCard className="h-5 w-5" />
          Confirmar Assinatura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Resumo do Plano */}
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
          <div className="text-3xl font-bold text-primary">
            {plan.price_cents === 0 ? "Grátis" : formatPrice(plan.price_cents)}
          </div>
          <p className="text-sm text-muted-foreground">
            {getBillingPeriodLabel(plan.billing_period)}
          </p>
        </div>

        {/* Recursos */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="w-full justify-center">
              Até {plan.student_limit} alunos
            </Badge>
          </div>
          
          {plan.features.map((feature, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </div>
          ))}
        </div>

        {/* Informações de Segurança */}
        <div className="bg-muted/50 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="h-4 w-4 text-green-500" />
            <span>Pagamento seguro processado pelo Stripe</span>
          </div>
        </div>

        {/* Botões */}
        <div className="space-y-2">
          <Button 
            onClick={handleCheckout} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : plan.billing_period === 'trial' ? (
              "Ativar Plano Gratuito"
            ) : (
              "Contatar Administrador"
            )}
          </Button>
          
          <Button 
            variant="outline" 
            onClick={onCancel}
            disabled={isLoading}
            className="w-full"
          >
            Cancelar
          </Button>
        </div>

        {plan.billing_period !== 'trial' && (
          <p className="text-xs text-center text-muted-foreground">
            Você pode cancelar sua assinatura a qualquer momento.
            Não há taxas de cancelamento.
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default StripeCheckout;