import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Crown, 
  User, 
  Calendar,
  Users,
  CreditCard,
  X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DialogTitle } from "@/components/ui/dialog";

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

interface PersonalTrainer {
  id: string;
  name: string;
  email?: string;
  cpf: string;
}

interface ManualSubscriptionAssignerProps {
  trainer: PersonalTrainer;
  onClose: () => void;
  onSuccess: () => void;
}

const ManualSubscriptionAssigner = ({ trainer, onClose, onSuccess }: ManualSubscriptionAssignerProps) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [customDuration, setCustomDuration] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(false);
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

  const handleAssignPlan = async () => {
    if (!selectedPlanId) {
      toast({
        title: "Erro",
        description: "Selecione um plano para atribuir.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // First, cancel any existing active subscription
      const { error: cancelError } = await supabase
        .from("subscriptions")
        .update({ status: "canceled" })
        .eq("personal_trainer_id", trainer.id)
        .eq("status", "active");

      if (cancelError) {
        console.error("Error canceling existing subscription:", cancelError);
      }

      // Calculate period dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + customDuration);

      // Create new subscription
      const { error: createError } = await supabase
        .from("subscriptions")
        .insert({
          personal_trainer_id: trainer.id,
          subscription_plan_id: selectedPlanId,
          status: "active",
          current_period_start: startDate.toISOString(),
          current_period_end: endDate.toISOString(),
          cancel_at_period_end: false,
          students_count: 0
        });

      if (createError) {
        throw createError;
      }

      const selectedPlan = plans.find(p => p.id === selectedPlanId);
      
      toast({
        title: "Plano atribuído com sucesso!",
        description: `${trainer.name} agora tem o plano ${selectedPlan?.name} por ${customDuration} dias.`,
      });

      onSuccess();
    } catch (error) {
      console.error("Error assigning plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao atribuir plano. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="space-y-6">
      <DialogTitle className="flex items-center gap-2">
        <Crown className="h-5 w-5" />
        Atribuir Plano Manualmente
      </DialogTitle>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Personal Trainer
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Nome:</strong> {trainer.name}</p>
            <p><strong>Email:</strong> {trainer.email || "N/A"}</p>
            <p><strong>CPF:</strong> {trainer.cpf}</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Selecionar Plano</Label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha um plano de assinatura" />
            </SelectTrigger>
            <SelectContent>
              {plans.map((plan) => (
                <SelectItem key={plan.id} value={plan.id}>
                  <div className="flex items-center justify-between w-full">
                    <span>{plan.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {formatPrice(plan.price_cents)} / {getBillingPeriodLabel(plan.billing_period)}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="duration">Duração (dias)</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            max="365"
            value={customDuration}
            onChange={(e) => setCustomDuration(parseInt(e.target.value) || 30)}
            placeholder="30"
          />
          <p className="text-xs text-muted-foreground">
            Número de dias que o plano ficará ativo
          </p>
        </div>

        {selectedPlan && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg">Resumo do Plano</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Plano:</span>
                <Badge variant="outline">{selectedPlan.name}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>Preço:</span>
                <span className="font-medium">{formatPrice(selectedPlan.price_cents)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Período:</span>
                <span>{getBillingPeriodLabel(selectedPlan.billing_period)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Limite de alunos:</span>
                <span className="font-medium">{selectedPlan.student_limit}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Duração:</span>
                <span className="font-medium">{customDuration} dias</span>
              </div>
              
              {selectedPlan.features && selectedPlan.features.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <p className="text-sm font-medium">Recursos inclusos:</p>
                  <div className="grid grid-cols-1 gap-1">
                    {selectedPlan.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2 text-sm">
                        <div className="w-1 h-1 bg-primary rounded-full"></div>
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onClose} className="flex-1">
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button 
          onClick={handleAssignPlan} 
          disabled={isLoading || !selectedPlanId}
          className="flex-1"
        >
          {isLoading ? "Atribuindo..." : "Atribuir Plano"}
        </Button>
      </div>
    </div>
  );
};

export default ManualSubscriptionAssigner;