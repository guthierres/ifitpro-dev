import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Crown, 
  Check, 
  Zap,
  Star,
  Users,
  Calendar,
  CreditCard
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionPlan {
  id: string;
  name: string;
  description?: string;
  price_cents: number;
  billing_period: string;
  student_limit: number;
  features: string[];
  active: boolean;
}

interface SubscriptionPlansProps {
  trainerId: string;
  currentPlanId?: string;
  onSelectPlan: (planId: string) => void;
}

const SubscriptionPlans = ({ trainerId, currentPlanId, onSelectPlan }: SubscriptionPlansProps) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("active", true)
        .order("price_cents");

      if (!error && data) {
        setPlans(data);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar planos de assinatura.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const getPlanIcon = (period: string) => {
    switch (period) {
      case 'trial':
        return <Star className="h-5 w-5 text-yellow-500" />;
      case 'monthly':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'quarterly':
        return <Zap className="h-5 w-5 text-purple-500" />;
      case 'yearly':
        return <Crown className="h-5 w-5 text-gold-500" />;
      default:
        return <CreditCard className="h-5 w-5 text-gray-500" />;
    }
  };

  const getPopularBadge = (period: string) => {
    if (period === 'quarterly') {
      return (
        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white">
          Mais Popular
        </Badge>
      );
    }
    if (period === 'yearly') {
      return (
        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white">
          Melhor Valor
        </Badge>
      );
    }
    return null;
  };

  const getDiscountPercentage = (period: string, price: number) => {
    if (period === 'quarterly') {
      const monthlyEquivalent = 3000 * 3; // 3 meses
      const discount = ((monthlyEquivalent - price) / monthlyEquivalent) * 100;
      return Math.round(discount);
    }
    if (period === 'yearly') {
      const monthlyEquivalent = 3000 * 12; // 12 meses
      const discount = ((monthlyEquivalent - price) / monthlyEquivalent) * 100;
      return Math.round(discount);
    }
    return 0;
  };

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="h-4 bg-muted rounded w-1/2"></div>
                <div className="h-8 bg-muted rounded"></div>
                <div className="h-20 bg-muted rounded"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Escolha seu Plano</h2>
        <p className="text-muted-foreground">
          Selecione o plano que melhor atende às suas necessidades
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrentPlan = plan.id === currentPlanId;
          const discount = getDiscountPercentage(plan.billing_period, plan.price_cents);
          
          return (
            <Card 
              key={plan.id} 
              className={`relative transition-all duration-300 hover:shadow-lg ${
                isCurrentPlan 
                  ? 'border-primary shadow-lg scale-105' 
                  : plan.billing_period === 'quarterly' 
                    ? 'border-purple-200 hover:border-purple-300' 
                    : plan.billing_period === 'yearly'
                      ? 'border-yellow-200 hover:border-yellow-300'
                      : 'hover:border-primary/50'
              }`}
            >
              {getPopularBadge(plan.billing_period)}
              
              <CardHeader className="text-center pb-4">
                <div className="flex justify-center mb-2">
                  {getPlanIcon(plan.billing_period)}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                {plan.description && (
                  <p className="text-sm text-muted-foreground">
                    {plan.description}
                  </p>
                )}
                
                <div className="space-y-1">
                  <div className="text-3xl font-bold text-primary">
                    {plan.price_cents === 0 ? "Grátis" : formatPrice(plan.price_cents)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {getBillingPeriodLabel(plan.billing_period)}
                  </div>
                  {discount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {discount}% de desconto
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Até {plan.student_limit} alunos</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Button 
                  className="w-full"
                  variant={isCurrentPlan ? "secondary" : "default"}
                  onClick={() => onSelectPlan(plan.id)}
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Plano Atual
                    </>
                  ) : plan.billing_period === 'trial' ? (
                    <>
                      <Star className="h-4 w-4 mr-2" />
                      Começar Teste
                    </>
                  ) : (
                    <>
                      <Crown className="h-4 w-4 mr-2" />
                      Selecionar Plano
                    </>
                  )}
                </Button>

                {plan.billing_period === 'trial' && (
                  <p className="text-xs text-center text-muted-foreground">
                    Sem compromisso • Cancele a qualquer momento
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center space-y-2 pt-4">
        <p className="text-sm text-muted-foreground">
          Todos os planos incluem suporte técnico e atualizações gratuitas
        </p>
        <p className="text-xs text-muted-foreground">
          Preços em Reais (BRL) • Pagamento seguro via Stripe
        </p>
      </div>
    </div>
  );
};

export default SubscriptionPlans;