import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import {
  CreditCard,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Crown,
  Zap,
  Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SubscriptionInfo {
  id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  students_count: number;
  cancel_at_period_end: boolean;
  subscription_plan: {
    name: string;
    price_cents: number;
    billing_period: string;
    student_limit: number;
    features: string[];
  };
}

interface SubscriptionStatusProps {
  trainerId: string;
}

const SubscriptionStatus = ({ trainerId }: SubscriptionStatusProps) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    loadSubscription();
  }, [trainerId]);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plan:subscription_plans(*)
        `)
        .eq("personal_trainer_id", trainerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        setSubscription(data[0]);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      console.error("Error loading subscription:", error);
      setSubscription(null);
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
      trial: "Teste",
      monthly: "Mensal",
      quarterly: "Trimestral",
      yearly: "Anual"
    };
    return labels[period as keyof typeof labels] || period;
  };

  const getDaysUntilExpiry = () => {
    if (!subscription) return 0;
    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getUsagePercentage = () => {
    if (!subscription) return 0;
    return Math.min(100, (subscription.students_count / subscription.subscription_plan.student_limit) * 100);
  };

  const isNearLimit = () => {
    return getUsagePercentage() >= 80;
  };

  const isExpiringSoon = () => {
    return getDaysUntilExpiry() <= 7;
  };

  const isPro = () => {
    return subscription && subscription.subscription_plan.billing_period !== 'trial';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3"></div>
            <div className="h-8 bg-muted rounded"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!subscription) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="text-center py-8">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold mb-2">Nenhuma assinatura ativa</h3>
          <p className="text-muted-foreground mb-4">
            Você está usando o plano gratuito com limite de 5 alunos.
          </p>
          <Button onClick={() => navigate("/subscription")}>
            <Crown className="h-4 w-4 mr-2" />
            Fazer Upgrade
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${isNearLimit() || isExpiringSoon() ? 'border-warning' : ''}`}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-primary" />
              {subscription.subscription_plan.name}
              <Badge variant="default">Ativo</Badge>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatPrice(subscription.subscription_plan.price_cents)} / {getBillingPeriodLabel(subscription.subscription_plan.billing_period)}
            </p>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Gerenciar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Uso de Alunos */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Alunos Cadastrados</span>
            </div>
            <span className="text-sm font-medium">
              {subscription.students_count} / {subscription.subscription_plan.student_limit}
            </span>
          </div>
          <Progress
            value={getUsagePercentage()}
            className={`h-2 ${isNearLimit() ? 'bg-warning/20' : ''}`}
          />
          {isNearLimit() && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Você está próximo do limite de alunos</span>
            </div>
          )}
        </div>

        {/* Período da Assinatura */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Período Atual</span>
          </div>
          <div className="text-sm">
            <p>
              <strong>Início:</strong> {new Date(subscription.current_period_start).toLocaleDateString('pt-BR')}
            </p>
            <p>
              <strong>Fim:</strong> {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
            </p>
            <p className={`${isExpiringSoon() ? 'text-warning font-medium' : 'text-muted-foreground'}`}>
              <strong>Expira em:</strong> {getDaysUntilExpiry()} dias
            </p>
          </div>
          {isExpiringSoon() && (
            <div className="flex items-center gap-2 text-warning text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Sua assinatura expira em breve</span>
            </div>
          )}
        </div>

        {/* Recursos do Plano */}
        {subscription.subscription_plan.features && subscription.subscription_plan.features.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recursos inclusos:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {subscription.subscription_plan.features.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-4 border-t">
          {(isNearLimit() || isExpiringSoon()) && (
            <Button onClick={() => navigate("/subscription")} className="flex-1">
              <Zap className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          )}
          <Button variant="outline" className="flex-1">
            Ver Histórico
          </Button>
        </div>

        {subscription.cancel_at_period_end && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertTriangle className="h-4 w-4" />
              <span>Assinatura será cancelada no final do período atual</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatus;