/*
  # Sistema de Mensalidades e Assinaturas

  1. Novas Tabelas
    - `subscription_plans` - Planos de assinatura disponíveis
    - `subscriptions` - Assinaturas ativas dos personal trainers
    - `stripe_settings` - Configurações da integração Stripe
    - `payment_history` - Histórico de pagamentos

  2. Segurança
    - Enable RLS em todas as novas tabelas
    - Políticas para acesso controlado

  3. Funcionalidades
    - Planos pré-definidos (mensal, trimestral, anual)
    - Planos personalizados
    - Controle de limites de alunos
    - Integração com Stripe
*/

-- Tabela de planos de assinatura
CREATE TABLE IF NOT EXISTS subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL,
  billing_period text NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'yearly', 'trial')),
  student_limit integer NOT NULL DEFAULT 5,
  features text[] DEFAULT '{}',
  stripe_price_id text,
  active boolean DEFAULT true,
  is_custom boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de assinaturas dos personal trainers
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personal_trainer_id uuid NOT NULL REFERENCES personal_trainers(id) ON DELETE CASCADE,
  subscription_plan_id uuid NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
  stripe_subscription_id text,
  stripe_customer_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'unpaid', 'trialing')),
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  cancel_at_period_end boolean DEFAULT false,
  students_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de configurações do Stripe
CREATE TABLE IF NOT EXISTS stripe_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publishable_key text,
  secret_key text,
  webhook_secret text,
  test_mode boolean DEFAULT true,
  enabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de histórico de pagamentos
CREATE TABLE IF NOT EXISTS payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_payment_intent_id text,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'brl',
  status text NOT NULL CHECK (status IN ('succeeded', 'failed', 'pending', 'canceled')),
  payment_method text,
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_trainer ON subscriptions(personal_trainer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON subscriptions(current_period_end);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- Triggers para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stripe_settings_updated_at
  BEFORE UPDATE ON stripe_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir planos padrão
INSERT INTO subscription_plans (name, description, price_cents, billing_period, student_limit, features) VALUES
('Teste 30 dias', 'Plano de teste gratuito por 30 dias', 0, 'trial', 5, '{"Até 5 alunos", "Suporte básico", "Recursos essenciais"}'),
('Mensal', 'Plano mensal para personal trainers', 3000, 'monthly', 70, '{"Até 70 alunos", "Suporte prioritário", "Todos os recursos", "Relatórios avançados"}'),
('Trimestral', 'Plano trimestral com desconto', 10000, 'quarterly', 100, '{"Até 100 alunos", "Suporte prioritário", "Todos os recursos", "Relatórios avançados", "15% de desconto"}'),
('Anual', 'Plano anual com maior desconto', 25000, 'yearly', 200, '{"Até 200 alunos", "Suporte VIP", "Todos os recursos", "Relatórios avançados", "30% de desconto"}'
);

-- Inserir configuração inicial do Stripe
INSERT INTO stripe_settings (test_mode, enabled) VALUES (true, false);

-- Enable RLS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para subscription_plans (todos podem ver planos ativos)
CREATE POLICY "Anyone can view active subscription plans"
  ON subscription_plans
  FOR SELECT
  USING (active = true);

-- Políticas RLS para subscriptions (trainers podem ver suas próprias assinaturas)
CREATE POLICY "Trainers can view own subscriptions"
  ON subscriptions
  FOR SELECT
  TO authenticated
  USING (
    personal_trainer_id IN (
      SELECT id FROM personal_trainers WHERE auth_user_id = auth.uid()
    )
  );

-- Políticas RLS para stripe_settings (apenas super admin)
CREATE POLICY "Only super admin can access stripe settings"
  ON stripe_settings
  FOR ALL
  TO authenticated
  USING (
    auth.jwt() ->> 'email' = 'guthierresc@hotmail.com'
  );

-- Políticas RLS para payment_history (trainers podem ver seu próprio histórico)
CREATE POLICY "Trainers can view own payment history"
  ON payment_history
  FOR SELECT
  TO authenticated
  USING (
    subscription_id IN (
      SELECT s.id FROM subscriptions s
      JOIN personal_trainers pt ON s.personal_trainer_id = pt.id
      WHERE pt.auth_user_id = auth.uid()
    )
  );

-- Função para verificar limite de alunos
CREATE OR REPLACE FUNCTION check_student_limit()
RETURNS TRIGGER AS $$
DECLARE
  trainer_subscription_limit integer;
  current_student_count integer;
BEGIN
  -- Buscar o limite de alunos da assinatura ativa do trainer
  SELECT sp.student_limit INTO trainer_subscription_limit
  FROM subscriptions s
  JOIN subscription_plans sp ON s.subscription_plan_id = sp.id
  WHERE s.personal_trainer_id = NEW.personal_trainer_id
    AND s.status = 'active'
    AND s.current_period_end > now()
  ORDER BY s.created_at DESC
  LIMIT 1;

  -- Se não há assinatura ativa, usar limite padrão de teste (5 alunos)
  IF trainer_subscription_limit IS NULL THEN
    trainer_subscription_limit := 5;
  END IF;

  -- Contar alunos ativos do trainer
  SELECT COUNT(*) INTO current_student_count
  FROM students
  WHERE personal_trainer_id = NEW.personal_trainer_id
    AND active = true;

  -- Verificar se excede o limite
  IF current_student_count >= trainer_subscription_limit THEN
    RAISE EXCEPTION 'Limite de alunos atingido. Seu plano permite até % alunos. Faça upgrade para adicionar mais alunos.', trainer_subscription_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para verificar limite ao inserir novo aluno
CREATE TRIGGER check_student_limit_trigger
  BEFORE INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION check_student_limit();

-- Função para atualizar contador de alunos na assinatura
CREATE OR REPLACE FUNCTION update_subscription_student_count()
RETURNS TRIGGER AS $$
DECLARE
  trainer_id uuid;
BEGIN
  -- Determinar o trainer_id baseado na operação
  IF TG_OP = 'DELETE' THEN
    trainer_id := OLD.personal_trainer_id;
  ELSE
    trainer_id := NEW.personal_trainer_id;
  END IF;

  -- Atualizar contador na assinatura ativa
  UPDATE subscriptions 
  SET students_count = (
    SELECT COUNT(*) 
    FROM students 
    WHERE personal_trainer_id = trainer_id AND active = true
  )
  WHERE personal_trainer_id = trainer_id 
    AND status = 'active'
    AND current_period_end > now();

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar contador de alunos
CREATE TRIGGER update_student_count_on_insert
  AFTER INSERT ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_student_count();

CREATE TRIGGER update_student_count_on_update
  AFTER UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_student_count();

CREATE TRIGGER update_student_count_on_delete
  AFTER DELETE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_subscription_student_count();