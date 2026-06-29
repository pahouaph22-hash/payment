-- ============================================
-- FINANCIAL MANAGEMENT SYSTEM - SUPABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- PROFILES (Users + Roles)
-- ============================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'manager', 'accountant', 'viewer')),
  avatar_url TEXT,
  language TEXT DEFAULT 'th' CHECK (language IN ('th', 'lo', 'en')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_lo TEXT,
  name_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'asset', 'debt')),
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES categories(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS (รายรับ/รายจ่าย)
-- ============================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  category_id UUID REFERENCES categories(id),
  description TEXT,
  note TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_no TEXT,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'bank_transfer', 'credit_card', 'check', 'other')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'pending', 'cancelled')),
  tags TEXT[],
  attachments TEXT[],
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COST ITEMS (ต้นทุน)
-- ============================================
CREATE TABLE cost_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name_th TEXT NOT NULL,
  name_lo TEXT,
  name_en TEXT,
  type TEXT NOT NULL CHECK (type IN ('cogs', 'operating', 'fixed', 'variable')),
  amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  unit TEXT,
  quantity DECIMAL(10,3) DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES categories(id),
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BUDGETS (งบประมาณ)
-- ============================================
CREATE TABLE budgets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly', 'quarterly', 'yearly', 'custom')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  alert_threshold DECIMAL(5,2) DEFAULT 80,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEBTS (หนี้และลูกหนี้)
-- ============================================
CREATE TABLE debts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  counterparty_name TEXT NOT NULL,
  counterparty_contact TEXT,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  paid_amount DECIMAL(15,2) DEFAULT 0,
  due_date DATE,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled')),
  description TEXT,
  note TEXT,
  attachments TEXT[],
  created_by UUID REFERENCES profiles(id),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debt payments history
CREATE TABLE debt_payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT DEFAULT 'cash',
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ASSETS (ทรัพย์สิน)
-- ============================================
CREATE TABLE assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('fixed', 'current', 'intangible')),
  purchase_date DATE NOT NULL,
  purchase_price DECIMAL(15,2) NOT NULL CHECK (purchase_price > 0),
  current_value DECIMAL(15,2),
  depreciation_rate DECIMAL(5,2) DEFAULT 0,
  depreciation_method TEXT DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'declining_balance', 'none')),
  useful_life_years INT DEFAULT 0,
  location TEXT,
  serial_number TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disposed', 'maintenance')),
  note TEXT,
  attachments TEXT[],
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CASH FLOW PLANNING
-- ============================================
CREATE TABLE cashflow_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  frequency TEXT NOT NULL CHECK (frequency IN ('once', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  category_id UUID REFERENCES categories(id),
  note TEXT,
  is_actual BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOG
-- ============================================
CREATE TABLE audit_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES profiles(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DEFAULT CATEGORIES (Thai/Lao/English)
-- ============================================
INSERT INTO categories (name_th, name_lo, name_en, type, icon, color) VALUES
-- Income
('ยอดขายสินค้า', 'ລາຍຮັບຂາຍສິນຄ້າ', 'Product Sales', 'income', '🛒', '#10b981'),
('รายได้จากบริการ', 'ລາຍຮັບຈາກການບໍລິການ', 'Service Revenue', 'income', '🔧', '#06b6d4'),
('รายได้ดอกเบี้ย', 'ລາຍຮັບດອກເບ້ຍ', 'Interest Income', 'income', '🏦', '#8b5cf6'),
('รายได้อื่น ๆ', 'ລາຍຮັບອື່ນໆ', 'Other Income', 'income', '💰', '#f59e0b'),
-- Expense
('ต้นทุนสินค้า', 'ຕົ້ນທຶນສິນຄ້າ', 'Cost of Goods', 'expense', '📦', '#ef4444'),
('เงินเดือนพนักงาน', 'ເງິນເດືອນພະນັກງານ', 'Salaries', 'expense', '👥', '#f97316'),
('ค่าเช่า', 'ຄ່າເຊົ່າ', 'Rent', 'expense', '🏢', '#ec4899'),
('ค่าสาธารณูปโภค', 'ຄ່າສາທາລະນູປະໂພກ', 'Utilities', 'expense', '💡', '#eab308'),
('ค่าการตลาด', 'ຄ່າການຕະຫຼາດ', 'Marketing', 'expense', '📢', '#6366f1'),
('ค่าขนส่ง', 'ຄ່າຂົນສົ່ງ', 'Transportation', 'expense', '🚚', '#14b8a6'),
('ค่าซ่อมบำรุง', 'ຄ່າສ້ອມແປງ', 'Maintenance', 'expense', '🔨', '#84cc16'),
('ค่าใช้จ่ายอื่น ๆ', 'ຄ່າໃຊ້ຈ່າຍອື່ນໆ', 'Other Expenses', 'expense', '📋', '#94a3b8');

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admin can manage all profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Transactions policies
CREATE POLICY "Authenticated users can view transactions" ON transactions FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Accountant+ can insert transactions" ON transactions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'accountant'))
);
CREATE POLICY "Accountant+ can update transactions" ON transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'accountant'))
);
CREATE POLICY "Admin/Manager can delete transactions" ON transactions FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Categories policies
CREATE POLICY "All authenticated can view categories" ON categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin/Manager can manage categories" ON categories FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Budgets policies
CREATE POLICY "Authenticated can view budgets" ON budgets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager+ can manage budgets" ON budgets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Debts policies
CREATE POLICY "Authenticated can view debts" ON debts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Accountant+ can manage debts" ON debts FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'accountant'))
);

-- Assets policies
CREATE POLICY "Authenticated can view assets" ON assets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Manager+ can manage assets" ON assets FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager'))
);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', 'ผู้ใช้'), NEW.email, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Update debt status based on payments
CREATE OR REPLACE FUNCTION update_debt_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  total_paid DECIMAL;
  debt_amount DECIMAL;
BEGIN
  SELECT SUM(amount) INTO total_paid FROM debt_payments WHERE debt_id = NEW.debt_id;
  SELECT amount INTO debt_amount FROM debts WHERE id = NEW.debt_id;

  UPDATE debts SET
    paid_amount = COALESCE(total_paid, 0),
    status = CASE
      WHEN COALESCE(total_paid, 0) >= debt_amount THEN 'paid'
      WHEN COALESCE(total_paid, 0) > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = NOW()
  WHERE id = NEW.debt_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_debt_payment AFTER INSERT ON debt_payments FOR EACH ROW EXECUTE FUNCTION update_debt_status();

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_created_by ON transactions(created_by);
CREATE INDEX idx_debts_status ON debts(status);
CREATE INDEX idx_debts_due_date ON debts(due_date);
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_budgets_period ON budgets(period_start, period_end);

-- ============================================
-- USEFUL VIEWS
-- ============================================

-- Monthly P&L Summary
CREATE OR REPLACE VIEW monthly_pnl AS
SELECT
  DATE_TRUNC('month', date) AS month,
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
  SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense,
  SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) AS net_profit
FROM transactions
WHERE status = 'completed'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;

-- Category spending summary
CREATE OR REPLACE VIEW category_summary AS
SELECT
  c.id,
  c.name_th,
  c.name_lo,
  c.name_en,
  c.type,
  c.icon,
  c.color,
  COUNT(t.id) AS transaction_count,
  SUM(t.amount) AS total_amount
FROM categories c
LEFT JOIN transactions t ON t.category_id = c.id AND t.status = 'completed'
GROUP BY c.id, c.name_th, c.name_lo, c.name_en, c.type, c.icon, c.color;
