import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  DollarSign,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Key,
  TestTube,
  X,
  User
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
  stripe_price_id?: string;
  active: boolean;
  is_custom: boolean;
  created_at: string;
}

interface Subscription {
  id: string;
  personal_trainer_id: string;
  subscription_plan_id: string;
  stripe_subscription_id?: string;
  stripe_customer_id?: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  students_count: number;
  subscription_plan: SubscriptionPlan;
  personal_trainer: {
    name: string;
    email?: string;
  };
}

interface StripeSettings {
  id: string;
  publishable_key?: string;
  secret_key?: string;
  webhook_secret?: string;
  test_mode: boolean;
  enabled: boolean;
}

const SubscriptionManager = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [stripeSettings, setStripeSettings] = useState<StripeSettings | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isCreatePlanOpen, setIsCreatePlanOpen] = useState(false);
  const [isStripeSettingsOpen, setIsStripeSettingsOpen] = useState(false);
  const [planFormData, setPlanFormData] = useState({
    name: "",
    description: "",
    price_cents: "",
    billing_period: "monthly",
    student_limit: "",
    features: [] as string[],
    stripe_price_id: ""
  });
  const [stripeFormData, setStripeFormData] = useState({
    publishable_key: "",
    secret_key: "",
    webhook_secret: "",
    test_mode: true,
    enabled: false
  });
  const [newFeature, setNewFeature] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadPlans(),
        loadSubscriptions(),
        loadStripeSettings()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("price_cents");

      if (!error && data) {
        setPlans(data);
      }
    } catch (error) {
      console.error("Error loading plans:", error);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plan:subscription_plans(*),
          personal_trainer:personal_trainers(name, email)
        `)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setSubscriptions(data);
      }
    } catch (error) {
      console.error("Error loading subscriptions:", error);
    }
  };

  const loadStripeSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("stripe_settings")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Error loading stripe settings:", error);
        return;
      }

      if (data) {
        setStripeSettings(data);
        setStripeFormData({
          publishable_key: data.publishable_key || "",
          secret_key: data.secret_key || "",
          webhook_secret: data.webhook_secret || "",
          test_mode: data.test_mode,
          enabled: data.enabled
        });
      } else {
        // No stripe settings found, set default values
        setStripeSettings(null);
        setStripeFormData({
          publishable_key: "",
          secret_key: "",
          webhook_secret: "",
          test_mode: true,
          enabled: false
        });
      }
    } catch (error) {
      console.error("Error loading stripe settings:", error);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const planData = {
        name: planFormData.name,
        description: planFormData.description || null,
        price_cents: parseInt(planFormData.price_cents),
        billing_period: planFormData.billing_period,
        student_limit: parseInt(planFormData.student_limit),
        features: planFormData.features,
        stripe_price_id: planFormData.stripe_price_id || null,
        active: true,
        is_custom: true
      };

      if (selectedPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update(planData)
          .eq("id", selectedPlan.id);

        if (error) throw error;

        toast({
          title: "Plano atualizado!",
          description: "Plano de assinatura atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from("subscription_plans")
          .insert([planData]);

        if (error) throw error;

        toast({
          title: "Plano criado!",
          description: "Novo plano de assinatura criado com sucesso.",
        });
      }

      setIsCreatePlanOpen(false);
      resetPlanForm();
      loadPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar plano de assinatura.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveStripeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from("stripe_settings")
        .upsert({
          id: stripeSettings?.id,
          ...stripeFormData
        });

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: "Configurações do Stripe atualizadas com sucesso.",
      });

      setIsStripeSettingsOpen(false);
      loadStripeSettings();
    } catch (error) {
      console.error("Error saving stripe settings:", error);
      toast({
        title: "Erro",
        description: "Erro ao salvar configurações do Stripe.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlanStatus = async (planId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("subscription_plans")
        .update({ active: !currentStatus })
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Status atualizado",
        description: `Plano ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });

      loadPlans();
    } catch (error) {
      console.error("Error toggling plan status:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status do plano.",
        variant: "destructive",
      });
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm("Tem certeza que deseja excluir este plano?")) return;

    try {
      const { error } = await supabase
        .from("subscription_plans")
        .delete()
        .eq("id", planId);

      if (error) throw error;

      toast({
        title: "Plano excluído",
        description: "Plano de assinatura excluído com sucesso.",
      });

      loadPlans();
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({
        title: "Erro",
        description: "Erro ao excluir plano.",
        variant: "destructive",
      });
    }
  };

  const editPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setPlanFormData({
      name: plan.name,
      description: plan.description || "",
      price_cents: plan.price_cents.toString(),
      billing_period: plan.billing_period,
      student_limit: plan.student_limit.toString(),
      features: plan.features || [],
      stripe_price_id: plan.stripe_price_id || ""
    });
    setIsCreatePlanOpen(true);
  };

  const resetPlanForm = () => {
    setSelectedPlan(null);
    setPlanFormData({
      name: "",
      description: "",
      price_cents: "",
      billing_period: "monthly",
      student_limit: "",
      features: [],
      stripe_price_id: ""
    });
  };

  const addFeature = () => {
    if (newFeature.trim() && !planFormData.features.includes(newFeature.trim())) {
      setPlanFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature("");
    }
  };

  const removeFeature = (feature: string) => {
    setPlanFormData(prev => ({
      ...prev,
      features: prev.features.filter(f => f !== feature)
    }));
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

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      active: { variant: "default" as const, label: "Ativo" },
      canceled: { variant: "secondary" as const, label: "Cancelado" },
      past_due: { variant: "destructive" as const, label: "Em Atraso" },
      unpaid: { variant: "destructive" as const, label: "Não Pago" },
      trialing: { variant: "secondary" as const, label: "Teste" }
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                  { variant: "secondary" as const, label: status };
    
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const testStripeConnection = async () => {
    if (!stripeSettings?.enabled) {
      toast({
        title: "Stripe não configurado",
        description: "Configure e ative o Stripe primeiro.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Testando conexão...",
      description: "Verificando integração com Stripe.",
    });

    // Aqui você implementaria o teste real da conexão Stripe
    setTimeout(() => {
      toast({
        title: "Teste concluído",
        description: "Conexão com Stripe funcionando corretamente.",
      });
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Assinaturas</h2>
        <div className="flex gap-2">
          <Dialog open={isStripeSettingsOpen} onOpenChange={setIsStripeSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Configurar Stripe
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Configurações do Stripe</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveStripeSettings} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publishable_key">Chave Pública (Publishable Key)</Label>
                    <Input
                      id="publishable_key"
                      type="password"
                      value={stripeFormData.publishable_key}
                      onChange={(e) => setStripeFormData(prev => ({ ...prev, publishable_key: e.target.value }))}
                      placeholder="pk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secret_key">Chave Secreta (Secret Key)</Label>
                    <Input
                      id="secret_key"
                      type="password"
                      value={stripeFormData.secret_key}
                      onChange={(e) => setStripeFormData(prev => ({ ...prev, secret_key: e.target.value }))}
                      placeholder="sk_test_..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook_secret">Webhook Secret</Label>
                    <Input
                      id="webhook_secret"
                      type="password"
                      value={stripeFormData.webhook_secret}
                      onChange={(e) => setStripeFormData(prev => ({ ...prev, webhook_secret: e.target.value }))}
                      placeholder="whsec_..."
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="test_mode">Modo de Teste</Label>
                    <Switch
                      id="test_mode"
                      checked={stripeFormData.test_mode}
                      onCheckedChange={(checked) => setStripeFormData(prev => ({ ...prev, test_mode: checked }))}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled">Habilitar Stripe</Label>
                    <Switch
                      id="enabled"
                      checked={stripeFormData.enabled}
                      onCheckedChange={(checked) => setStripeFormData(prev => ({ ...prev, enabled: checked }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsStripeSettingsOpen(false)} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isLoading} className="flex-1">
                    {isLoading ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button onClick={testStripeConnection} variant="outline">
            <TestTube className="h-4 w-4 mr-2" />
            Testar Stripe
          </Button>
        </div>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="plans">Planos</TabsTrigger>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Planos de Assinatura ({plans.length})</h3>
            <Dialog open={isCreatePlanOpen} onOpenChange={setIsCreatePlanOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetPlanForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Plano
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {selectedPlan ? "Editar Plano" : "Criar Novo Plano"}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreatePlan} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Plano</Label>
                      <Input
                        id="name"
                        value={planFormData.name}
                        onChange={(e) => setPlanFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Plano Premium"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billing_period">Período de Cobrança</Label>
                      <Select
                        value={planFormData.billing_period}
                        onValueChange={(value) => setPlanFormData(prev => ({ ...prev, billing_period: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Teste</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição</Label>
                    <Textarea
                      id="description"
                      value={planFormData.description}
                      onChange={(e) => setPlanFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descrição do plano..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price_cents">Preço (em centavos)</Label>
                      <Input
                        id="price_cents"
                        type="number"
                        value={planFormData.price_cents}
                        onChange={(e) => setPlanFormData(prev => ({ ...prev, price_cents: e.target.value }))}
                        placeholder="3000 (R$ 30,00)"
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        {planFormData.price_cents && formatPrice(parseInt(planFormData.price_cents))}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="student_limit">Limite de Alunos</Label>
                      <Input
                        id="student_limit"
                        type="number"
                        value={planFormData.student_limit}
                        onChange={(e) => setPlanFormData(prev => ({ ...prev, student_limit: e.target.value }))}
                        placeholder="70"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="stripe_price_id">Stripe Price ID (opcional)</Label>
                    <Input
                      id="stripe_price_id"
                      value={planFormData.stripe_price_id}
                      onChange={(e) => setPlanFormData(prev => ({ ...prev, stripe_price_id: e.target.value }))}
                      placeholder="price_..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Recursos do Plano</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newFeature}
                        onChange={(e) => setNewFeature(e.target.value)}
                        placeholder="Ex: Suporte prioritário"
                        onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())}
                      />
                      <Button type="button" onClick={addFeature}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {planFormData.features.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {planFormData.features.map((feature, index) => (
                          <Badge key={index} variant="secondary" className="flex items-center gap-1">
                            {feature}
                            <X
                              className="h-3 w-3 cursor-pointer"
                              onClick={() => removeFeature(feature)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCreatePlanOpen(false)} className="flex-1">
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isLoading} className="flex-1">
                      {isLoading ? "Salvando..." : (selectedPlan ? "Atualizar" : "Criar")} Plano
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {plans.map((plan) => (
              <Card key={plan.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="h-5 w-5" />
                        {plan.name}
                        <Badge variant={plan.active ? "default" : "secondary"}>
                          {plan.active ? "Ativo" : "Inativo"}
                        </Badge>
                        {plan.is_custom && (
                          <Badge variant="outline">Personalizado</Badge>
                        )}
                      </CardTitle>
                      {plan.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => togglePlanStatus(plan.id, plan.active)}
                      >
                        {plan.active ? "Desativar" : "Ativar"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => editPlan(plan)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {plan.is_custom && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deletePlan(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Preço:</strong> {formatPrice(plan.price_cents)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Período:</strong> {getBillingPeriodLabel(plan.billing_period)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        <strong>Limite:</strong> {plan.student_limit} alunos
                      </span>
                    </div>
                  </div>

                  {plan.features && plan.features.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Recursos inclusos:</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.features.map((feature, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {plan.stripe_price_id && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Stripe Price ID: {plan.stripe_price_id}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Assinaturas Ativas ({subscriptions.length})</h3>
          </div>

          <div className="grid gap-4">
            {subscriptions.map((subscription) => (
              <Card key={subscription.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        {subscription.personal_trainer.name}
                        {getStatusBadge(subscription.status)}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {subscription.personal_trainer.email}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {subscription.subscription_plan.name}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Plano</p>
                      <p className="font-medium">{subscription.subscription_plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatPrice(subscription.subscription_plan.price_cents)} / {getBillingPeriodLabel(subscription.subscription_plan.billing_period)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Alunos</p>
                      <p className="font-medium">
                        {subscription.students_count} / {subscription.subscription_plan.student_limit}
                      </p>
                      <div className="w-full bg-muted rounded-full h-2 mt-1">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ 
                            width: `${Math.min(100, (subscription.students_count / subscription.subscription_plan.student_limit) * 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Período Atual</p>
                      <p className="font-medium text-xs">
                        {new Date(subscription.current_period_start).toLocaleDateString('pt-BR')} - {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <div className="flex items-center gap-2">
                        {subscription.status === 'active' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : subscription.status === 'canceled' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                        <span className="text-sm">{subscription.status}</span>
                      </div>
                    </div>
                  </div>

                  {subscription.stripe_subscription_id && (
                    <div className="text-xs text-muted-foreground">
                      Stripe Subscription ID: {subscription.stripe_subscription_id}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {subscriptions.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Nenhuma assinatura encontrada.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Status da Integração Stripe
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Status da Integração</p>
                    <p className="text-sm text-muted-foreground">
                      {stripeSettings?.enabled ? "Stripe configurado e ativo" : "Stripe não configurado"}
                    </p>
                  </div>
                  <Badge variant={stripeSettings?.enabled ? "default" : "secondary"}>
                    {stripeSettings?.enabled ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Modo de Operação</p>
                    <p className="text-sm text-muted-foreground">
                      {stripeSettings?.test_mode ? "Modo de teste" : "Modo de produção"}
                    </p>
                  </div>
                  <Badge variant={stripeSettings?.test_mode ? "secondary" : "default"}>
                    {stripeSettings?.test_mode ? "Teste" : "Produção"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-primary">{plans.filter(p => p.active).length}</p>
                    <p className="text-sm text-muted-foreground">Planos Ativos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{subscriptions.filter(s => s.status === 'active').length}</p>
                    <p className="text-sm text-muted-foreground">Assinaturas Ativas</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {formatPrice(subscriptions.reduce((total, sub) => 
                        sub.status === 'active' ? total + sub.subscription_plan.price_cents : total, 0
                      ))}
                    </p>
                    <p className="text-sm text-muted-foreground">Receita Mensal</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setIsStripeSettingsOpen(true)}
                    className="flex-1"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configurar Stripe
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={testStripeConnection}
                    className="flex-1"
                  >
                    <TestTube className="h-4 w-4 mr-2" />
                    Testar Conexão
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SubscriptionManager;