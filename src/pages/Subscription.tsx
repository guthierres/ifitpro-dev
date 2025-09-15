import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ArrowLeft,
  CreditCard,
  Crown,
  History,
  Settings,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SubscriptionStatus from "@/components/SubscriptionStatus";
import SubscriptionPlans from "@/components/SubscriptionPlans";
import StripeCheckout from "@/components/StripeCheckout";

interface PersonalTrainer {
  id: string;
  name: string;
  email?: string;
}

const Subscription = () => {
  const [trainer, setTrainer] = useState<PersonalTrainer | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const trainerData = localStorage.getItem("trainer");
    if (!trainerData) {
      navigate("/login");
      return;
    }

    const parsedTrainer = JSON.parse(trainerData);
    setTrainer(parsedTrainer);
    loadCurrentSubscription(parsedTrainer.id);
  }, [navigate]);

  const loadCurrentSubscription = async (trainerId: string) => {
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
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading current subscription:", error);
      } else if (data) {
        setCurrentSubscription(data);
      }
    } catch (error) {
      console.error("Error loading current subscription:", error);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (!trainer) return;

    try {
      console.log("Selecting plan:", planId);
      // CORREÇÃO: Destruturação correta para capturar 'data' e 'error'
      const { data: plan, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("id", planId)
        .single();

      if (error) {
        console.error("Error fetching plan:", error);
        toast({
          title: "Erro",
          description: `Erro ao carregar plano: ${error.message}`,
          variant: "destructive",
        });
        return;
      }

      if (plan) {
        console.log("Plan loaded successfully:", plan);
        setSelectedPlan(plan);
        setShowCheckout(true);
      } else {
        console.error("Plan not found");
        toast({
          title: "Erro",
          description: "Plano não encontrado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error selecting plan:", error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao carregar plano selecionado.",
        variant: "destructive",
      });
    }
  };

  const handleCheckoutSuccess = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
    if (trainer) {
      loadCurrentSubscription(trainer.id);
    }
    toast({
      title: "Assinatura ativada!",
      description: "Sua assinatura foi ativada com sucesso.",
    });
  };

  const handleCheckoutCancel = () => {
    setShowCheckout(false);
    setSelectedPlan(null);
  };

  if (!trainer) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Assinaturas</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie sua assinatura e planos
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="current" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="current">Atual</TabsTrigger>
            <TabsTrigger value="plans">Planos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            <SubscriptionStatus trainerId={trainer.id} />
          </TabsContent>

          <TabsContent value="plans" className="space-y-4">
            <SubscriptionPlans
              trainerId={trainer.id}
              currentPlanId={currentSubscription?.subscription_plan_id}
              onSelectPlan={handleSelectPlan}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de Pagamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">
                    Nenhum histórico de pagamento encontrado.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Stripe Checkout Dialog */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="max-w-md">
          {selectedPlan && (
            <StripeCheckout
              plan={selectedPlan}
              trainerId={trainer.id}
              onSuccess={handleCheckoutSuccess}
              onCancel={handleCheckoutCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Subscription;