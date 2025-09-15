import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Crown, Users, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface SubscriptionGuardProps {
  trainerId: string;
  children: React.ReactNode;
  requiredAction?: "create_student" | "create_workout" | "create_diet";
}

interface SubscriptionInfo {
  status: string;
  students_count: number;
  subscription_plan: {
    name: string;
    student_limit: number;
    billing_period: string;
  };
  current_period_end: string;
}

const SubscriptionGuard = ({ trainerId, children, requiredAction }: SubscriptionGuardProps) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [canPerformAction, setCanPerformAction] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    checkSubscription();
  }, [trainerId, requiredAction]);

  const checkSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          status,
          students_count,
          current_period_end,
          subscription_plan:subscription_plans(
            name,
            student_limit,
            billing_period
          )
        `)
        .eq("personal_trainer_id", trainerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        setSubscription(data);
        
        // Verificar se pode realizar a ação
        if (requiredAction === "create_student") {
          const canCreate = data.students_count < data.subscription_plan.student_limit;
          setCanPerformAction(canCreate);
        } else {
          setCanPerformAction(true);
        }
      } else {
        // Sem assinatura ativa - usar limites do plano gratuito
        setSubscription(null);
        
        if (requiredAction === "create_student") {
          // Verificar quantos alunos o trainer já tem
          const { data: studentsData } = await supabase
            .from("students")
            .select("id")
            .eq("personal_trainer_id", trainerId)
            .eq("active", true);
          
          const studentCount = studentsData?.length || 0;
          setCanPerformAction(studentCount < 5); // Limite gratuito de 5 alunos
        }
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      setCanPerformAction(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Se pode realizar a ação, renderizar o conteúdo normalmente
  if (canPerformAction) {
    return <>{children}</>;
  }

  // Se não pode realizar a ação, mostrar bloqueio
  return (
    <Card className="border-warning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <Lock className="h-5 w-5" />
          Limite Atingido
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {subscription ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Plano Atual:</span>
              <Badge variant="outline">{subscription.subscription_plan.name}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Alunos:</span>
              <span className="font-medium">
                {subscription.students_count} / {subscription.subscription_plan.student_limit}
              </span>
            </div>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Você atingiu o limite de {subscription.subscription_plan.student_limit} alunos do seu plano {subscription.subscription_plan.name}.
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Plano Atual:</span>
              <Badge variant="secondary">Gratuito</Badge>
            </div>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3">
              <div className="flex items-center gap-2 text-warning text-sm">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Você atingiu o limite de 5 alunos do plano gratuito.
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={() => navigate("/subscription")}
            className="flex-1"
          >
            <Crown className="h-4 w-4 mr-2" />
            Fazer Upgrade
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate("/dashboard")}
            className="flex-1"
          >
            Voltar ao Dashboard
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionGuard;