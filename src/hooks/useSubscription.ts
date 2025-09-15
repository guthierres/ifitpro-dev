import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionInfo {
  id: string;
  status: string;
  students_count: number;
  current_period_end: string;
  subscription_plan: {
    name: string;
    student_limit: number;
    billing_period: string;
    price_cents: number;
  };
}

export const useSubscription = (trainerId: string) => {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trainerId) {
      loadSubscription();
    }
  }, [trainerId]);

  const loadSubscription = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from("subscriptions")
        .select(`
          *,
          subscription_plan:subscription_plans(*)
        `)
        .eq("personal_trainer_id", trainerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      if (supabaseError) {
        throw supabaseError;
      }

      setSubscription(data && data.length > 0 ? data[0] : null);
    } catch (err) {
      console.error("Error loading subscription:", err);
      setError("Erro ao carregar informações da assinatura");
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  const canAddStudent = () => {
    if (!subscription) {
      // Sem assinatura ativa, usar limite gratuito de 5 alunos
      return subscription?.students_count < 5;
    }
    return subscription.students_count < subscription.subscription_plan.student_limit;
  };

  const getStudentLimit = () => {
    return subscription?.subscription_plan.student_limit || 5;
  };

  const getStudentCount = () => {
    return subscription?.students_count || 0;
  };

  const isExpiringSoon = () => {
    if (!subscription) return false;
    const now = new Date();
    const endDate = new Date(subscription.current_period_end);
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7;
  };

  const isNearLimit = () => {
    const usage = (getStudentCount() / getStudentLimit()) * 100;
    return usage >= 80;
  };

  return {
    subscription,
    isLoading,
    error,
    canAddStudent,
    getStudentLimit,
    getStudentCount,
    isExpiringSoon,
    isNearLimit,
    reload: loadSubscription
  };
};