(function() {
  'use strict';

  var forecastDays = 30;
  var forecastChartInst = null;
  var txData = []; // last 90 days transactions for analysis
  var debtsData = [];
  var savingsData = [];

  checkAuth().then(function(session) {
    if (!session) return;
    initUI();
    loadAll();
  });

  function initUI() {
    var p = APP.profile;
    if (!p) return;
    document.getElementById('userAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
    document.getElementById('userName').textContent = p.full_name || p.email;
    var roleMap = { admin: 'ผู้ดูแล', manager: 'ผู้จัดการ', accountant: 'นักบัญชี', viewer: 'ผู้ดู' };
    document.getElementById('userRole').textContent = roleMap[p.role] || p.role;
    if (p.role !== 'admin') document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = 'none'; });
    if (localStorage.getItem('finance_dark') === '1') {
      document.body.classList.add('dark-mode');
      document.getElementById('darkBtn').textContent = '☀️';
    }
    if (window.innerWidth <= 768) document.querySelector('.menu-toggle').style.display = 'flex';
    window.addEventListener('resize', function() {
      var t = document.querySelector('.menu-toggle');
      if (t) t.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    });
    setGreeting();
  }

  window.toggleDark = function() {
    document.body.classList.toggle('dark-mode');
    var isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('finance_dark', isDark ? '1' : '0');
    document.getElementById('darkBtn').textContent = isDark ? '☀️' : '🌙';
  };

  window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
  };

  function setGreeting() {
    var h = new Date().getHours();
    var greeting = h < 12 ? 'สวัสดีตอนเช้า 👋' : h < 17 ? 'สวัสดีตอนบ่าย ☀️' : 'สวัสดีตอนเย็น 🌙';
    var name = APP.profile ? (APP.profile.full_name || '').split(' ')[0] : '';
    document.getElementById('ccGreeting').textContent = greeting + (name ? ' คุณ' + name : '');
  }

  // ============================================
  // LOAD ALL DATA
  // ============================================
  async function loadAll() {
    var ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    var fromDate = ninetyDaysAgo.toISOString().split('T')[0];

    var [txRes, debtsRes, savingsRes, billsRes] = await Promise.all([
      supabase.from('transactions').select('*, categories(name_th, icon, color)').eq('status', 'completed').gte('date', fromDate).order('date', { ascending: false }),
      supabase.from('debts').select('*'),
      tryFetch('savings_accounts'),
      tryFetch('scheduled_bills')
    ]);

    txData = txRes.data || [];
    debtsData = debtsRes.data || [];
    savingsData = savingsRes || [];
    var billsData = billsRes || [];

    renderHeroStats();
    var health = calculateHealthScore();
    renderHealthScore(health);
    renderInsights(health);
    renderForecast();
    renderCalendar(billsData);
  }

  async function tryFetch(table) {
    try {
      var r = await supabase.from(table).select('*');
      return r.data || [];
    } catch (e) { return []; }
  }

  // ============================================
  // HERO STATS
  // ============================================
  function renderHeroStats() {
    var today = todayISO();
    var mStart = monthStart(), mEnd = monthEnd();

    var totalIncome = 0, totalExpense = 0;
    var todayInc = 0, todayExp = 0;
    var monthInc = 0, monthExp = 0;

    txData.forEach(function(t) {
      var amt = Number(t.amount);
      if (t.type === 'income') {
        totalIncome += amt;
        if (t.date === today) todayInc += amt;
        if (t.date >= mStart && t.date <= mEnd) monthInc += amt;
      } else {
        totalExpense += amt;
        if (t.date === today) todayExp += amt;
        if (t.date >= mStart && t.date <= mEnd) monthExp += amt;
      }
    });

    // Note: totalIncome/Expense here only covers 90 days; for true all-time balance, do separate query
    document.getElementById('statTodayIncome').textContent = APP.t('baht') + formatMoney(todayInc, 0);
    document.getElementById('statTodayExpense').textContent = APP.t('baht') + formatMoney(todayExp, 0);
    var monthProfit = monthInc - monthExp;
    document.getElementById('statMonthProfit').textContent = (monthProfit < 0 ? '-' : '') + APP.t('baht') + formatMoney(Math.abs(monthProfit), 0);

    // Due today count
    var dueTodayCount = debtsData.filter(function(d) {
      return d.due_date === today && ['pending', 'partial', 'overdue'].includes(d.status);
    }).length;
    document.getElementById('statDueToday').textContent = dueTodayCount + ' รายการ';

    // Get true all-time balance
    supabase.from('transactions').select('type, amount').eq('status', 'completed').then(function(r) {
      var inc = 0, exp = 0;
      (r.data || []).forEach(function(t) {
        if (t.type === 'income') inc += Number(t.amount);
        else exp += Number(t.amount);
      });
      document.getElementById('ccTotalBalance').textContent = APP.t('baht') + formatMoney(inc - exp);
    });
  }

  // ============================================
  // FINANCIAL HEALTH SCORE ALGORITHM
  // ============================================
  function calculateHealthScore() {
    // 1. LIQUIDITY (สภาพคล่อง) - 0-100
    // based on: balance trend, income vs expense ratio over last 30 days
    var thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    var recent30 = txData.filter(function(t) { return new Date(t.date) >= thirtyDaysAgo; });
    var inc30 = 0, exp30 = 0;
    recent30.forEach(function(t) { if (t.type === 'income') inc30 += Number(t.amount); else exp30 += Number(t.amount); });

    var liquidityScore;
    if (inc30 === 0 && exp30 === 0) liquidityScore = 50;
    else if (inc30 === 0) liquidityScore = 0;
    else {
      var ratio = exp30 / inc30;
      // ratio <= 0.5 -> 100, ratio >= 1.5 -> 0
      liquidityScore = Math.max(0, Math.min(100, (1.5 - ratio) / 1.0 * 100));
    }

    // 2. DEBT (หนี้สิน) - 0-100
    // based on: total debt vs total income (30 days), overdue count
    var totalDebtOutstanding = 0, overdueCount = 0, totalDebtCount = 0;
    debtsData.forEach(function(d) {
      if (d.type === 'payable' && ['pending', 'partial', 'overdue'].includes(d.status)) {
        totalDebtOutstanding += Number(d.amount) - Number(d.paid_amount || 0);
        totalDebtCount++;
        if (d.status === 'overdue' || (d.due_date && d.due_date < todayISO())) overdueCount++;
      }
    });

    var debtScore = 100;
    if (inc30 > 0) {
      var debtToIncomeRatio = totalDebtOutstanding / (inc30 * 12 / 30 * 30); // rough annualized comparison, simplify:
      var debtRatio = totalDebtOutstanding / Math.max(inc30, 1);
      debtScore = Math.max(0, 100 - debtRatio * 20);
    } else if (totalDebtOutstanding > 0) {
      debtScore = 40;
    }
    debtScore -= overdueCount * 15;
    debtScore = Math.max(0, Math.min(100, debtScore));

    // 3. SAVINGS (เงินออม) - 0-100
    // based on: savings rate (income - expense)/income, and savings account presence
    var savingsRate = inc30 > 0 ? (inc30 - exp30) / inc30 : 0;
    var savingsScore = Math.max(0, Math.min(100, (savingsRate + 0.1) / 0.4 * 100)); // savingsRate 0.3 = 100, -0.1 = 0

    var hasSavingsAccount = savingsData.some(function(s) { return s.status === 'active'; });
    if (hasSavingsAccount) savingsScore = Math.min(100, savingsScore + 10);

    var overall = Math.round(liquidityScore * 0.35 + debtScore * 0.35 + savingsScore * 0.30);

    return {
      overall: overall,
      liquidity: Math.round(liquidityScore),
      debt: Math.round(debtScore),
      savings: Math.round(savingsScore),
      inc30: inc30, exp30: exp30,
      totalDebtOutstanding: totalDebtOutstanding,
      overdueCount: overdueCount,
      savingsRate: savingsRate
    };
  }

  function gradeFromScore(score) {
    if (score >= 80) return { label: 'ดีเยี่ยม', color: '#10b981', bg: 'rgba(16,185,129,.25)' };
    if (score >= 60) return { label: 'ดี', color: '#84cc16', bg: 'rgba(132,204,22,.25)' };
    if (score >= 40) return { label: 'ปานกลาง', color: '#f59e0b', bg: 'rgba(245,158,11,.25)' };
    if (score >= 20) return { label: 'ต้องระวัง', color: '#f97316', bg: 'rgba(249,115,22,.25)' };
    return { label: 'วิกฤต', color: '#ef4444', bg: 'rgba(239,68,68,.25)' };
  }

  function renderHealthScore(h) {
    document.getElementById('ccHealthScore').textContent = h.overall;
    var grade = gradeFromScore(h.overall);
    var gradeEl = document.getElementById('ccHealthGrade');
    gradeEl.textContent = grade.label;
    gradeEl.style.background = grade.bg;
    gradeEl.style.color = '#fff';

    var items = [
      { label: 'สภาพคล่อง', score: h.liquidity, icon: '💧' },
      { label: 'หนี้สิน', score: h.debt, icon: '🤝' },
      { label: 'เงินออม', score: h.savings, icon: '🏦' }
    ];

    document.getElementById('healthBreakdown').innerHTML = items.map(function(it) {
      var g = gradeFromScore(it.score);
      return '<div class="health-item">' +
        '<div class="hi-label">' + it.icon + ' ' + it.label + '</div>' +
        '<div class="hi-score" style="color:' + g.color + ';">' + it.score + '</div>' +
        '<div class="health-bar-bg"><div class="health-bar" style="width:' + it.score + '%;background:' + g.color + ';"></div></div>' +
      '</div>';
    }).join('');
  }

  // ============================================
  // AI INSIGHTS (RULE-BASED)
  // ============================================
  function renderInsights(h) {
    var insights = [];

    // 1. Overall health insight
    var grade = gradeFromScore(h.overall);
    if (h.overall < 40) {
      insights.push({ type: 'danger', icon: '🚨', title: 'สุขภาพการเงินอยู่ในระดับ' + grade.label, desc: 'คะแนนรวม ' + h.overall + '/100 ควรพิจารณาลดรายจ่ายและวางแผนชำระหนี้อย่างเร่งด่วน' });
    } else if (h.overall >= 80) {
      insights.push({ type: 'success', icon: '🎉', title: 'สุขภาพการเงินดีเยี่ยม!', desc: 'คะแนนรวม ' + h.overall + '/100 รักษาวินัยทางการเงินแบบนี้ต่อไป' });
    }

    // 2. Liquidity insight
    if (h.liquidity < 40 && h.inc30 > 0) {
      var ratio = (h.exp30 / h.inc30 * 100).toFixed(0);
      insights.push({ type: 'warning', icon: '💧', title: 'รายจ่ายสูงเทียบกับรายรับ', desc: 'ใน 30 วันที่ผ่านมา รายจ่ายคิดเป็น ' + ratio + '% ของรายรับ ลองหาทางลดค่าใช้จ่ายที่ไม่จำเป็น' });
    }

    // 3. Debt insight
    if (h.overdueCount > 0) {
      insights.push({ type: 'danger', icon: '⚠️', title: 'มีหนี้เกินกำหนดชำระ ' + h.overdueCount + ' รายการ', desc: 'ควรรีบจัดการชำระเพื่อหลีกเลี่ยงดอกเบี้ยเพิ่มเติมหรือผลกระทบด้านเครดิต' });
    }
    if (h.totalDebtOutstanding > 0 && h.inc30 > 0 && h.totalDebtOutstanding > h.inc30 * 3) {
      insights.push({ type: 'warning', icon: '🤝', title: 'ภาระหนี้สูงเทียบกับรายรับ', desc: 'ยอดหนี้คงค้างรวม ' + APP.t('baht') + formatMoney(h.totalDebtOutstanding, 0) + ' สูงกว่ารายรับ 30 วันถึง ' + (h.totalDebtOutstanding / h.inc30).toFixed(1) + ' เท่า' });
    }

    // 4. Savings rate insight
    if (h.savingsRate < 0) {
      insights.push({ type: 'danger', icon: '📉', title: 'ใช้จ่ายเกินรายรับ', desc: 'ช่วง 30 วันที่ผ่านมาใช้จ่ายมากกว่ารายรับ ' + APP.t('baht') + formatMoney(Math.abs(h.exp30 - h.inc30), 0) + ' ควรทบทวนงบประมาณ' });
    } else if (h.savingsRate >= 0.2) {
      insights.push({ type: 'success', icon: '💰', title: 'อัตราการออมดีมาก', desc: 'คุณออมได้ ' + (h.savingsRate * 100).toFixed(0) + '% ของรายรับ ในช่วง 30 วันที่ผ่านมา' });
    }

    // 5. Category spending anomaly detection
    var categorySpendThisMonth = {};
    var categorySpendLastMonth = {};
    var mStart = monthStart(), mEnd = monthEnd();
    var now = new Date();
    var lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    var lmStart = new Date(lm.getFullYear(), lm.getMonth(), 1).toISOString().split('T')[0];
    var lmEnd = new Date(lm.getFullYear(), lm.getMonth() + 1, 0).toISOString().split('T')[0];

    txData.forEach(function(t) {
      if (t.type !== 'expense') return;
      var catName = (t.categories && t.categories.name_th) || 'อื่นๆ';
      if (t.date >= mStart && t.date <= mEnd) {
        categorySpendThisMonth[catName] = (categorySpendThisMonth[catName] || 0) + Number(t.amount);
      }
      if (t.date >= lmStart && t.date <= lmEnd) {
        categorySpendLastMonth[catName] = (categorySpendLastMonth[catName] || 0) + Number(t.amount);
      }
    });

    Object.keys(categorySpendThisMonth).forEach(function(cat) {
      var thisM = categorySpendThisMonth[cat];
      var lastM = categorySpendLastMonth[cat] || 0;
      if (lastM > 0 && thisM > lastM * 1.5 && thisM - lastM > 50000) {
        var pctIncrease = ((thisM - lastM) / lastM * 100).toFixed(0);
        insights.push({ type: 'warning', icon: '📊', title: 'ค่าใช้จ่าย "' + cat + '" เพิ่มขึ้นผิดปกติ', desc: 'เดือนนี้ใช้ไป ' + APP.t('baht') + formatMoney(thisM, 0) + ' เพิ่มขึ้น ' + pctIncrease + '% จากเดือนที่แล้ว' });
      }
    });

    // 6. Predict month-end balance
    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var daysPassed = now.getDate();
    var daysLeft = daysInMonth - daysPassed;
    if (daysPassed >= 3) {
      var dailyExpRate = h.exp30 / 30;
      var projectedAdditionalExpense = dailyExpRate * daysLeft;
      var monthExpenseSoFar = 0, monthIncomeSoFar = 0;
      txData.forEach(function(t) {
        if (t.date >= mStart && t.date <= mEnd) {
          if (t.type === 'income') monthIncomeSoFar += Number(t.amount);
          else monthExpenseSoFar += Number(t.amount);
        }
      });
      var projectedMonthEnd = monthIncomeSoFar - monthExpenseSoFar - projectedAdditionalExpense;
      insights.push({
        type: projectedMonthEnd < 0 ? 'danger' : 'info', icon: '🔮',
        title: 'คาดการณ์ปลายเดือน',
        desc: 'หากใช้จ่ายในอัตราเดิม คาดว่าสิ้นเดือนนี้จะมีกำไรสุทธิประมาณ ' + (projectedMonthEnd < 0 ? '-' : '') + APP.t('baht') + formatMoney(Math.abs(projectedMonthEnd), 0)
      });
    }

    // 7. No data
    if (txData.length === 0) {
      insights.push({ type: 'info', icon: '👋', title: 'เริ่มต้นบันทึกรายการแรกของคุณ', desc: 'ยังไม่มีข้อมูลรายรับ-รายจ่าย เริ่มบันทึกเพื่อให้ระบบวิเคราะห์และให้คำแนะนำได้' });
    }

    if (insights.length === 0) {
      insights.push({ type: 'info', icon: '✅', title: 'ไม่มีรายการผิดปกติ', desc: 'การเงินของคุณดูเป็นปกติดี ระบบจะแจ้งเตือนทันทีที่พบสิ่งผิดปกติ' });
    }

    document.getElementById('insightsList').innerHTML = insights.map(function(ins) {
      return '<div class="insight-card ' + ins.type + '">' +
        '<div class="insight-icon">' + ins.icon + '</div>' +
        '<div><div class="insight-title">' + ins.title + '</div><div class="insight-desc">' + ins.desc + '</div></div>' +
      '</div>';
    }).join('');
  }

  // ============================================
  // CASH FLOW FORECAST
  // ============================================
  window.setForecastDays = function(days) {
    forecastDays = days;
    ['30', '60', '90'].forEach(function(d) {
      document.getElementById('ft' + d).classList.toggle('active', parseInt(d) === days);
    });
    renderForecast();
  };

  function renderForecast() {
    // Calculate average daily income/expense from last 30 days
    var thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    var recent = txData.filter(function(t) { return new Date(t.date) >= thirtyDaysAgo; });
    var inc = 0, exp = 0;
    recent.forEach(function(t) { if (t.type === 'income') inc += Number(t.amount); else exp += Number(t.amount); });
    var dailyIncRate = inc / 30;
    var dailyExpRate = exp / 30;

    // Get current balance
    supabase.from('transactions').select('type, amount').eq('status', 'completed').then(function(r) {
      var totalInc = 0, totalExp = 0;
      (r.data || []).forEach(function(t) { if (t.type === 'income') totalInc += Number(t.amount); else totalExp += Number(t.amount); });
      var currentBalance = totalInc - totalExp;

      var labels = ['วันนี้'];
      var data = [currentBalance];
      var balance = currentBalance;

      // Include known upcoming debt payments
      var upcomingDebts = debtsData.filter(function(d) { return d.type === 'payable' && ['pending', 'partial'].includes(d.status) && d.due_date; });

      var step = forecastDays <= 30 ? 2 : forecastDays <= 60 ? 4 : 6;
      for (var d = step; d <= forecastDays; d += step) {
        var dailyChange = (dailyIncRate - dailyExpRate) * step;
        balance += dailyChange;

        // Subtract debt payments due in this period
        var periodStart = new Date(); periodStart.setDate(periodStart.getDate() + d - step);
        var periodEnd = new Date(); periodEnd.setDate(periodEnd.getDate() + d);
        upcomingDebts.forEach(function(deb) {
          var dueD = new Date(deb.due_date);
          if (dueD > periodStart && dueD <= periodEnd) {
            balance -= (Number(deb.amount) - Number(deb.paid_amount || 0));
          }
        });

        var futureDate = new Date(); futureDate.setDate(futureDate.getDate() + d);
        labels.push(futureDate.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }));
        data.push(balance);
      }

      if (forecastChartInst) forecastChartInst.destroy();
      forecastChartInst = new Chart(document.getElementById('forecastChart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'คาดการณ์ยอดคงเหลือ',
            data: data,
            borderColor: data[data.length - 1] < 0 ? '#ef4444' : '#6366f1',
            backgroundColor: data[data.length - 1] < 0 ? 'rgba(239,68,68,.1)' : 'rgba(99,102,241,.1)',
            tension: .3, fill: true, pointRadius: 3
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { y: { ticks: { callback: function(v) { return APP.t('baht') + formatMoney(v, 0); } } } }
        }
      });

      var finalBalance = data[data.length - 1];
      var changeAmt = finalBalance - currentBalance;
      document.getElementById('forecastSummary').innerHTML =
        '📌 ในอีก <strong>' + forecastDays + ' วัน</strong> คาดว่ายอดคงเหลือจะเป็น <strong style="color:' + (finalBalance < 0 ? '#ef4444' : '#10b981') + ';">' + APP.t('baht') + formatMoney(finalBalance, 0) + '</strong>' +
        ' (' + (changeAmt >= 0 ? '+' : '') + APP.t('baht') + formatMoney(changeAmt, 0) + ')' +
        (finalBalance < 0 ? '<br><span style="color:#ef4444;">⚠️ มีความเสี่ยงเงินสดติดลบ ควรวางแผนรายรับเพิ่มเติม</span>' : '');
    });
  }

  // ============================================
  // FINANCIAL CALENDAR
  // ============================================
  function renderCalendar(billsData) {
    var today = new Date();
    var twoWeeksLater = new Date(); twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);
    var todayStr = todayISO();
    var twoWeeksStr = twoWeeksLater.toISOString().split('T')[0];

    var events = [];

    // From debts
    debtsData.forEach(function(d) {
      if (d.due_date && d.due_date <= twoWeeksStr && ['pending', 'partial', 'overdue'].includes(d.status)) {
        events.push({
          date: d.due_date,
          title: (d.type === 'payable' ? '💸 ชำระหนี้: ' : '💰 รับเงิน: ') + d.counterparty_name,
          amount: Number(d.amount) - Number(d.paid_amount || 0),
          type: d.type === 'payable' ? 'expense' : 'income'
        });
      }
    });

    // From savings (maturity dates)
    savingsData.forEach(function(s) {
      if (s.maturity_date && s.maturity_date <= twoWeeksStr && s.status === 'active') {
        events.push({
          date: s.maturity_date,
          title: '🏦 ครบกำหนดฝาก: ' + s.account_name,
          amount: Number(s.principal_balance),
          type: 'income'
        });
      }
    });

    // From scheduled_bills
    (billsData || []).forEach(function(b) {
      if (b.due_date <= twoWeeksStr && !b.is_paid) {
        events.push({
          date: b.due_date,
          title: '📄 ' + b.bill_name,
          amount: Number(b.amount || 0),
          type: b.bill_type === 'income' ? 'income' : 'expense'
        });
      }
    });

    events.sort(function(a, b) { return a.date.localeCompare(b.date); });

    var listEl = document.getElementById('calendarList');
    if (events.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:24px;color:#94a3b8;">ไม่มีรายการที่ต้องดำเนินการใน 14 วันข้างหน้า</div>';
      return;
    }

    listEl.innerHTML = events.slice(0, 10).map(function(ev) {
      var d = new Date(ev.date);
      var isToday = ev.date === todayStr;
      var isOverdue = ev.date < todayStr;
      var monthShort = d.toLocaleDateString('th-TH', { month: 'short' });
      return '<div class="calendar-item' + (isToday ? ' today' : isOverdue ? ' overdue' : '') + '">' +
        '<div class="cal-date-box"><div class="d">' + d.getDate() + '</div><div class="m">' + monthShort + '</div></div>' +
        '<div style="flex:1;"><div style="font-size:13px;font-weight:500;">' + ev.title + '</div>' +
        '<div style="font-size:11px;color:var(--gray-400);">' + (isToday ? 'วันนี้' : isOverdue ? 'เลยกำหนดแล้ว' : formatDate(ev.date)) + '</div></div>' +
        '<div style="font-weight:600;font-size:13px;" class="' + (ev.type === 'income' ? 'text-income' : 'text-expense') + '">' + APP.t('baht') + formatMoney(ev.amount, 0) + '</div>' +
      '</div>';
    }).join('');
  }

})();
