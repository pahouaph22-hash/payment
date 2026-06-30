(function() {
  'use strict';

  var allAccounts = [];
  var currentTab = 'all';
  var progressChartInst = null;
  var simChartInst = null;
  var currentDetailAccountId = null;

  checkAuth().then(function(session) {
    if (!session) return;
    initUI();
    document.getElementById('fAccStartDate').value = todayISO();
    document.getElementById('fTxDate').value = todayISO();
    var now = new Date();
    document.getElementById('histFrom').value = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    document.getElementById('histTo').value = todayISO();
    loadAccounts();
  });

  function applyLang() {
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
      var key = el.getAttribute('data-i18n');
      var val = APP.t(key);
      if (val && val !== key) el.textContent = val;
    });
    document.querySelectorAll('.lang-btn').forEach(function(b) { b.classList.remove('active'); });
    var btnMap = { th: 'langBtnTh', lo: 'langBtnLo', en: 'langBtnEn' };
    if (btnMap[APP.lang]) document.getElementById(btnMap[APP.lang]).classList.add('active');
    document.documentElement.lang = APP.lang;
  }

  function initUI() {
    var p = APP.profile;
    if (!p) return;
    document.getElementById('userAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
    document.getElementById('userName').textContent = p.full_name || p.email;
    var roleMap = { admin: 'ผู้ดูแล', manager: 'ผู้จัดการ', accountant: 'นักบัญชี', viewer: 'ผู้ดู' };
    document.getElementById('userRole').textContent = roleMap[p.role] || p.role;
    if (p.role !== 'admin') document.querySelectorAll('.admin-only').forEach(function(el) { el.style.display = 'none'; });
    if (!canEdit()) {
      var addBtn = document.querySelector('.header-actions .btn-primary');
      if (addBtn) addBtn.style.display = 'none';
    }
    applyLang();
    if (window.innerWidth <= 768) document.querySelector('.menu-toggle').style.display = 'flex';
    window.addEventListener('resize', function() {
      var t = document.querySelector('.menu-toggle');
      if (t) t.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    });
  }

  window.switchLang = function(lang) {
    APP.setLang(lang);
    if (APP.profile) supabase.from('profiles').update({ language: lang }).eq('id', APP.profile.id);
    applyLang();
    loadAccounts();
  };

  window.toggleSidebar = function() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
  };

  function getMonthlyRate(rate, rateType) {
    var r = Number(rate) || 0;
    if (rateType === 'yearly') return r / 12;
    return r;
  }

  function monthsBetween(start, end) {
    var s = new Date(start), e = new Date(end);
    var months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    var dayFrac = (e.getDate() - s.getDate()) / 30;
    return Math.max(0, months + dayFrac);
  }

  function calculateAccruedInterest(acc) {
    var principal = Number(acc.principal_balance);
    var monthlyRate = getMonthlyRate(acc.interest_rate, acc.interest_rate_type) / 100;
    var endDate = todayISO();
    if (acc.maturity_date && acc.status !== 'active' && new Date(endDate) > new Date(acc.maturity_date)) endDate = acc.maturity_date;
    var elapsedMonths = monthsBetween(acc.start_date, endDate);

    if (acc.interest_calc_method === 'compound') {
      var freq = acc.compound_frequency || 'monthly';
      var nPeriods, ratePerPeriod;
      if (freq === 'daily') { nPeriods = elapsedMonths * 30; ratePerPeriod = monthlyRate / 30; }
      else if (freq === 'monthly') { nPeriods = elapsedMonths; ratePerPeriod = monthlyRate; }
      else if (freq === 'quarterly') { nPeriods = elapsedMonths / 3; ratePerPeriod = monthlyRate * 3; }
      else { nPeriods = elapsedMonths / 12; ratePerPeriod = monthlyRate * 12; }
      var total = principal * Math.pow(1 + ratePerPeriod, nPeriods);
      return Math.max(0, total - principal);
    } else {
      return principal * monthlyRate * elapsedMonths;
    }
  }

  function calculateTotal(acc) {
    return Number(acc.principal_balance) + calculateAccruedInterest(acc);
  }

  async function loadAccounts() {
    var r = await supabase.from('savings_accounts').select('*').order('created_at', { ascending: false });
    allAccounts = r.data || [];

    var today = todayISO();
    allAccounts.forEach(function(a) {
      if (a.account_type === 'term_deposit' && a.maturity_date && a.maturity_date <= today && a.status === 'active') {
        a.status = 'matured';
      }
    });

    updateKPIs();
    renderReminders();
    renderProgressChart();
    filterAndRenderAccounts();
  }

  function updateKPIs() {
    var totalPrincipal = 0, totalInterest = 0;
    var maturingSoonCount = 0;
    var soon = new Date(); soon.setDate(soon.getDate() + 30);
    var soonStr = soon.toISOString().split('T')[0];

    allAccounts.forEach(function(a) {
      if (a.status === 'closed') return;
      totalPrincipal += Number(a.principal_balance);
      totalInterest += calculateAccruedInterest(a);
      if (a.account_type === 'term_deposit' && a.maturity_date && a.maturity_date <= soonStr && a.status !== 'closed') {
        maturingSoonCount++;
      }
    });

    document.getElementById('kpiTotalPrincipal').textContent = APP.t('baht') + formatMoney(totalPrincipal);
    document.getElementById('kpiTotalInterest').textContent = APP.t('baht') + formatMoney(totalInterest);
    document.getElementById('kpiGrandTotal').textContent = APP.t('baht') + formatMoney(totalPrincipal + totalInterest);
    document.getElementById('kpiMaturingSoon').textContent = maturingSoonCount + ' บัญชี';
  }

  function renderReminders() {
    var soon = new Date(); soon.setDate(soon.getDate() + 30);
    var soonStr = soon.toISOString().split('T')[0];
    var today = todayISO();

    var reminders = allAccounts.filter(function(a) {
      return a.account_type === 'term_deposit' && a.maturity_date && a.maturity_date <= soonStr && a.status !== 'closed';
    }).sort(function(a, b) { return a.maturity_date.localeCompare(b.maturity_date); });

    var section = document.getElementById('remindersSection');
    var list = document.getElementById('remindersList');

    if (reminders.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    list.innerHTML = reminders.map(function(a) {
      var daysLeft = Math.ceil((new Date(a.maturity_date) - new Date(today)) / 86400000);
      var isUrgent = daysLeft <= 7;
      var statusText = daysLeft < 0 ? 'ครบกำหนดแล้ว' : daysLeft === 0 ? 'ครบกำหนดวันนี้!' : 'อีก ' + daysLeft + ' วัน';
      return '<div class="reminder-item' + (isUrgent ? ' urgent' : '') + '">' +
        '<div class="reminder-icon">' + (isUrgent ? '\uD83D\uDEA8' : '\u23F0') + '</div>' +
        '<div style="flex:1;">' +
          '<div style="font-weight:600;font-size:13px;">' + a.icon + ' ' + a.account_name + '</div>' +
          '<div style="font-size:12px;color:var(--gray-500);">ครบกำหนด ' + formatDate(a.maturity_date) + ' \u2014 ' + statusText + '</div>' +
        '</div>' +
        '<button class="btn btn-outline btn-sm" onclick="openDetail(\'' + a.id + '\')">ดูรายละเอียด</button>' +
      '</div>';
    }).join('');
  }

  function renderProgressChart() {
    var active = allAccounts.filter(function(a) { return a.status !== 'closed'; });
    var labels = active.map(function(a) { return a.account_name; });
    var principals = active.map(function(a) { return Number(a.principal_balance); });
    var interests = active.map(function(a) { return calculateAccruedInterest(a); });

    if (progressChartInst) progressChartInst.destroy();
    if (active.length === 0) return;

    progressChartInst = new Chart(document.getElementById('savingsProgressChart'), {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'เงินต้น', data: principals, backgroundColor: 'rgba(99,102,241,.8)', borderRadius: 6 },
          { label: 'ดอกเบี้ยสะสม', data: interests, backgroundColor: 'rgba(16,185,129,.8)', borderRadius: 6 }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, ticks: { callback: function(v) { return APP.t('baht') + formatMoney(v, 0); } } }
        }
      }
    });
  }

  window.setMainTab = function(tab) {
    currentTab = tab;
    var idMap = { all: 'mtAll', savings: 'mtSavings', term_deposit: 'mtTerm', closed: 'mtClosed' };
    ['all', 'savings', 'term_deposit', 'closed'].forEach(function(t) {
      document.getElementById(idMap[t]).classList.toggle('active', t === tab);
    });
    filterAndRenderAccounts();
  };

  function filterAndRenderAccounts() {
    var filtered = allAccounts.filter(function(a) {
      if (currentTab === 'all') return a.status !== 'closed';
      if (currentTab === 'closed') return a.status === 'closed';
      return a.account_type === currentTab && a.status !== 'closed';
    });
    renderAccountCards(filtered);
  }

  function renderAccountCards(list) {
    var grid = document.getElementById('accountGrid');
    if (!list.length) {
      grid.innerHTML = '<div style="text-align:center;padding:60px;color:#94a3b8;grid-column:1/-1;">' +
        '<div style="font-size:48px;margin-bottom:12px;">\uD83C\uDFE6</div>' +
        '<div>ยังไม่มีบัญชี</div>' +
        '<div style="margin-top:8px;font-size:13px;">คลิก "เปิดบัญชีใหม่" เพื่อเริ่มต้น</div>' +
      '</div>';
      return;
    }

    grid.innerHTML = list.map(function(a) {
      var total = calculateTotal(a);
      var interest = total - Number(a.principal_balance);
      var isTerm = a.account_type === 'term_deposit';
      var cardClass = a.status === 'closed' ? 'closed' : a.status === 'matured' ? 'matured' : (isTerm ? 'term' : 'savings');
      var rateLabel = a.interest_rate + '%' + (a.interest_rate_type === 'yearly' ? '/ปี' : '/เดือน');

      var goalHtml = '';
      if (!isTerm && a.goal_amount) {
        var pct = Math.min(total / Number(a.goal_amount) * 100, 100);
        goalHtml = '<div class="maturity-progress"><div class="maturity-bar" style="width:' + pct + '%;"></div></div>' +
          '<div style="font-size:10px;opacity:.8;margin-top:3px;position:relative;z-index:1;">เป้าหมาย ' + pct.toFixed(0) + '% \u2014 ' + APP.t('baht') + formatMoney(a.goal_amount, 0) + '</div>';
      }

      var maturityHtml = '';
      if (isTerm && a.maturity_date) {
        var daysLeft = Math.ceil((new Date(a.maturity_date) - new Date()) / 86400000);
        var totalDays = monthsBetween(a.start_date, a.maturity_date) * 30;
        var elapsedDays = totalDays - daysLeft;
        var pctTime = Math.min(Math.max(elapsedDays / totalDays * 100, 0), 100);
        maturityHtml = '<div class="maturity-progress"><div class="maturity-bar" style="width:' + pctTime + '%;"></div></div>' +
          '<div style="font-size:10px;opacity:.8;margin-top:3px;position:relative;z-index:1;">' +
          (daysLeft > 0 ? 'ครบกำหนดอีก ' + daysLeft + ' วัน' : daysLeft === 0 ? 'ครบกำหนดวันนี้' : 'ครบกำหนดแล้ว') +
          '</div>';
      }

      return '<div class="bank-card ' + cardClass + '">' +
        '<div>' +
          '<div class="bank-card-top">' +
            '<div><div class="bank-card-name">' + a.account_name + '</div>' +
            '<div class="bank-card-sub">' + (a.bank_name || (isTerm ? 'ฝากประจำ' : 'บัญชีออมเงิน')) + (a.account_number ? ' \u2022 ' + a.account_number : '') + '</div></div>' +
            '<div class="bank-card-icon">' + a.icon + '</div>' +
          '</div>' +
          '<div class="bank-card-balance">' + APP.t('baht') + formatMoney(total) + '</div>' +
          '<div class="bank-card-label">เงินต้น ' + APP.t('baht') + formatMoney(a.principal_balance, 0) + ' + ดอกเบี้ย ' + APP.t('baht') + formatMoney(interest, 0) + '</div>' +
          goalHtml + maturityHtml +
        '</div>' +
        '<div>' +
          '<div class="bank-card-footer">' +
            '<span class="bank-card-rate">\uD83D\uDCCA ' + rateLabel + '</span>' +
            '<span>' + (a.status === 'matured' ? '\u2705 ครบกำหนด' : a.status === 'closed' ? '\uD83D\uDCE6 ปิดแล้ว' : '\uD83D\uDFE2 ใช้งานอยู่') + '</span>' +
          '</div>' +
          '<div class="bank-card-actions">' +
            '<button onclick="openDetail(\'' + a.id + '\')">\uD83D\uDC41\uFE0F รายละเอียด</button>' +
            (a.status === 'active' && canEdit() ? '<button onclick="quickDeposit(\'' + a.id + '\')">\uD83D\uDCB0 ฝากเงิน</button>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  window.setAccType = function(type) {
    document.getElementById('fAccType').value = type;
    document.getElementById('accBtnSavings').className = type === 'savings' ? 'active-savings' : '';
    document.getElementById('accBtnTerm').className = type === 'term_deposit' ? 'active-term' : '';
    var isTerm = type === 'term_deposit';
    document.getElementById('fAccGoalWrap').style.display = isTerm ? 'none' : 'block';
    document.getElementById('fAccTermWrap').style.display = isTerm ? 'block' : 'none';
    document.getElementById('fAccMaturityWrap').style.display = isTerm ? 'flex' : 'none';
    document.getElementById('fAccAutoRenewWrap').style.display = isTerm ? 'block' : 'none';
    document.getElementById('fAccIcon').value = isTerm ? '\uD83D\uDC9A' : '\uD83C\uDFE6';
  };

  window.toggleCompoundFreq = function() {
    var isCompound = document.getElementById('fAccCalcMethod').value === 'compound';
    document.getElementById('fCompoundFreqWrap').style.display = isCompound ? 'block' : 'none';
  };

  window.calcMaturityDate = function() {
    var start = document.getElementById('fAccStartDate').value;
    var months = parseInt(document.getElementById('fAccTermMonths').value);
    if (!start || !months) return;
    var d = new Date(start);
    d.setMonth(d.getMonth() + months);
    document.getElementById('fAccMaturityDate').value = d.toISOString().split('T')[0];
  };

  window.openAccountModal = function() {
    document.getElementById('accEditId').value = '';
    document.getElementById('accountModalTitle').textContent = '\uD83C\uDFE6 เปิดบัญชีใหม่';
    document.getElementById('fAccName').value = '';
    document.getElementById('fAccBank').value = '';
    document.getElementById('fAccNumber').value = '';
    document.getElementById('fAccPrincipal').value = '';
    document.getElementById('fAccGoal').value = '';
    document.getElementById('fAccRate').value = '';
    document.getElementById('fAccRateType').value = 'yearly';
    document.getElementById('fAccCalcMethod').value = 'simple';
    document.getElementById('fAccCompoundFreq').value = 'monthly';
    document.getElementById('fAccStartDate').value = todayISO();
    document.getElementById('fAccTermMonths').value = '';
    document.getElementById('fAccMaturityDate').value = '';
    document.getElementById('fAccPayoutFreq').value = 'maturity';
    document.getElementById('fAccAutoRenew').checked = false;
    document.getElementById('fAccColor').value = '#6366f1';
    document.getElementById('fAccNote').value = '';
    toggleCompoundFreq();
    setAccType('savings');
    openModal('accountModal');
  };

  window.editFromDetail = function() {
    closeModal('detailModal');
    editAccount(currentDetailAccountId);
  };

  function editAccount(id) {
    var a = allAccounts.find(function(x) { return x.id === id; });
    if (!a) return;
    document.getElementById('accEditId').value = a.id;
    document.getElementById('accountModalTitle').textContent = '\u270F\uFE0F แก้ไขบัญชี';
    document.getElementById('fAccName').value = a.account_name;
    document.getElementById('fAccBank').value = a.bank_name || '';
    document.getElementById('fAccNumber').value = a.account_number || '';
    document.getElementById('fAccPrincipal').value = a.principal_balance;
    document.getElementById('fAccGoal').value = a.goal_amount || '';
    document.getElementById('fAccRate').value = a.interest_rate;
    document.getElementById('fAccRateType').value = a.interest_rate_type;
    document.getElementById('fAccCalcMethod').value = a.interest_calc_method;
    document.getElementById('fAccCompoundFreq').value = a.compound_frequency || 'monthly';
    document.getElementById('fAccStartDate').value = a.start_date;
    document.getElementById('fAccTermMonths').value = a.term_months || '';
    document.getElementById('fAccMaturityDate').value = a.maturity_date || '';
    document.getElementById('fAccPayoutFreq').value = a.payout_frequency || 'maturity';
    document.getElementById('fAccAutoRenew').checked = !!a.auto_renew;
    document.getElementById('fAccIcon').value = a.icon || '\uD83C\uDFE6';
    document.getElementById('fAccColor').value = a.color || '#6366f1';
    document.getElementById('fAccNote').value = a.note || '';
    toggleCompoundFreq();
    setAccType(a.account_type);
    openModal('accountModal');
  }

  window.saveAccount = async function() {
    var name = document.getElementById('fAccName').value.trim();
    var principal = parseFloat(document.getElementById('fAccPrincipal').value);
    var rate = parseFloat(document.getElementById('fAccRate').value);
    var startDate = document.getElementById('fAccStartDate').value;
    var type = document.getElementById('fAccType').value;

    if (!name) { showToast('กรุณาระบุชื่อบัญชี', 'error'); return; }
    if (isNaN(principal) || principal < 0) { showToast('กรุณาระบุยอดเงินต้น', 'error'); return; }
    if (isNaN(rate)) { showToast('กรุณาระบุอัตราดอกเบี้ย', 'error'); return; }
    if (!startDate) { showToast('กรุณาระบุวันที่เปิดบัญชี', 'error'); return; }

    var data = {
      account_name: name,
      account_type: type,
      bank_name: document.getElementById('fAccBank').value.trim() || null,
      account_number: document.getElementById('fAccNumber').value.trim() || null,
      principal_balance: principal,
      interest_rate: rate,
      interest_rate_type: document.getElementById('fAccRateType').value,
      interest_calc_method: document.getElementById('fAccCalcMethod').value,
      compound_frequency: document.getElementById('fAccCompoundFreq').value,
      goal_amount: type === 'savings' ? (parseFloat(document.getElementById('fAccGoal').value) || null) : null,
      start_date: startDate,
      term_months: type === 'term_deposit' ? (parseInt(document.getElementById('fAccTermMonths').value) || null) : null,
      maturity_date: type === 'term_deposit' ? (document.getElementById('fAccMaturityDate').value || null) : null,
      payout_frequency: document.getElementById('fAccPayoutFreq').value,
      auto_renew: document.getElementById('fAccAutoRenew').checked,
      icon: document.getElementById('fAccIcon').value || '\uD83C\uDFE6',
      color: document.getElementById('fAccColor').value,
      note: document.getElementById('fAccNote').value.trim() || null
    };

    var editId = document.getElementById('accEditId').value;
    var result;
    if (editId) {
      result = await supabase.from('savings_accounts').update(data).eq('id', editId);
    } else {
      data.created_by = APP.user.id;
      data.status = 'active';
      result = await supabase.from('savings_accounts').insert([data]).select().single();
    }

    if (result.error) { showToast('เกิดข้อผิดพลาด: ' + result.error.message, 'error'); return; }

    if (!editId && result.data && principal > 0) {
      await supabase.from('savings_transactions').insert([{
        account_id: result.data.id,
        type: 'deposit',
        amount: principal,
        balance_after: principal,
        transaction_date: startDate,
        note: 'ยอดเงินต้นเริ่มต้น',
        created_by: APP.user.id
      }]);
    }

    showToast(editId ? 'แก้ไขบัญชีสำเร็จ' : 'เปิดบัญชีสำเร็จ \u2705');
    closeModal('accountModal');
    loadAccounts();
  };

  window.quickDeposit = function(accountId) {
    openTxModal(accountId, 'deposit');
  };

  function openTxModal(accountId, type) {
    var a = allAccounts.find(function(x) { return x.id === accountId; });
    if (!a) return;
    document.getElementById('txAccountId').value = accountId;
    document.getElementById('txType').value = type;
    document.getElementById('txModalTitle').textContent = (type === 'deposit' ? '\uD83D\uDCB0 ฝากเงิน \u2014 ' : '\uD83D\uDCB8 ถอนเงิน \u2014 ') + a.account_name;
    document.getElementById('txCurrentBalance').textContent = APP.t('baht') + formatMoney(calculateTotal(a));
    document.getElementById('fTxAmount').value = '';
    document.getElementById('fTxDate').value = todayISO();
    document.getElementById('fTxNote').value = '';
    var btn = document.getElementById('txSaveBtn');
    btn.className = type === 'deposit' ? 'btn btn-success' : 'btn btn-danger';
    openModal('txModal');
  }

  window.openTxModalFromDetail = function(type) {
    closeModal('detailModal');
    openTxModal(currentDetailAccountId, type);
  };

  window.saveTx = async function() {
    var accountId = document.getElementById('txAccountId').value;
    var type = document.getElementById('txType').value;
    var amount = parseFloat(document.getElementById('fTxAmount').value);
    var date = document.getElementById('fTxDate').value || todayISO();

    if (!amount || amount <= 0) { showToast('กรุณาระบุจำนวนเงิน', 'error'); return; }

    var a = allAccounts.find(function(x) { return x.id === accountId; });
    if (!a) return;

    var newPrincipal = type === 'deposit' ? Number(a.principal_balance) + amount : Number(a.principal_balance) - amount;
    if (newPrincipal < 0) { showToast('ยอดเงินไม่เพียงพอสำหรับถอน', 'error'); return; }

    var updateResult = await supabase.from('savings_accounts').update({ principal_balance: newPrincipal }).eq('id', accountId);
    if (updateResult.error) { showToast('เกิดข้อผิดพลาด', 'error'); return; }

    await supabase.from('savings_transactions').insert([{
      account_id: accountId,
      type: type,
      amount: amount,
      balance_after: newPrincipal,
      transaction_date: date,
      note: document.getElementById('fTxNote').value.trim() || null,
      created_by: APP.user.id
    }]);

    showToast(type === 'deposit' ? 'ฝากเงินสำเร็จ \u2705' : 'ถอนเงินสำเร็จ \u2705');
    closeModal('txModal');
    await loadAccounts();

    if (currentDetailAccountId === accountId) {
      openDetail(accountId);
    }
  };

  window.openDetail = function(id) {
    currentDetailAccountId = id;
    var a = allAccounts.find(function(x) { return x.id === id; });
    if (!a) return;

    var total = calculateTotal(a);
    var interest = total - Number(a.principal_balance);
    var isTerm = a.account_type === 'term_deposit';

    document.getElementById('detailModalTitle').textContent = a.icon + ' ' + a.account_name;
    document.getElementById('detailAccName').textContent = (a.bank_name || (isTerm ? 'ฝากประจำ' : 'บัญชีออมเงิน')) + (a.account_number ? ' \u2022 ' + a.account_number : '');
    document.getElementById('detailBalance').textContent = APP.t('baht') + formatMoney(total);
    document.getElementById('detailRate').textContent = '\uD83D\uDCCA อัตราดอกเบี้ย ' + a.interest_rate + '%' + (a.interest_rate_type === 'yearly' ? ' ต่อปี' : ' ต่อเดือน') + (a.interest_calc_method === 'compound' ? ' (ทบต้น)' : '');
    document.getElementById('detailPrincipal').textContent = APP.t('baht') + formatMoney(a.principal_balance);
    document.getElementById('detailInterest').textContent = APP.t('baht') + formatMoney(interest);
    document.getElementById('detailTotal').textContent = APP.t('baht') + formatMoney(total);

    if (!isTerm && a.goal_amount) {
      var pct = Math.min(total / Number(a.goal_amount) * 100, 100);
      document.getElementById('detailGoalSection').style.display = 'block';
      document.getElementById('detailGoalPct').textContent = pct.toFixed(1) + '%';
      document.getElementById('detailGoalBar').style.width = pct + '%';
      var needed = Math.max(0, Number(a.goal_amount) - total);
      document.getElementById('detailGoalText').textContent = needed > 0 ? 'ต้องออมอีก ' + APP.t('baht') + formatMoney(needed) + ' เพื่อถึงเป้าหมาย ' + APP.t('baht') + formatMoney(a.goal_amount, 0) : '\uD83C\uDF89 ถึงเป้าหมายแล้ว!';
    } else {
      document.getElementById('detailGoalSection').style.display = 'none';
    }

    if (isTerm && a.maturity_date) {
      var daysLeft = Math.ceil((new Date(a.maturity_date) - new Date()) / 86400000);
      document.getElementById('detailMaturitySection').style.display = 'block';
      document.getElementById('detailMaturityText').textContent =
        '\uD83D\uDCC5 วันครบกำหนด: ' + formatDate(a.maturity_date) +
        (daysLeft > 0 ? ' (อีก ' + daysLeft + ' วัน)' : daysLeft === 0 ? ' (วันนี้!)' : ' (เกินกำหนดแล้ว)') +
        (a.auto_renew ? ' \u2022 ต่ออายุอัตโนมัติ' : '');
    } else {
      document.getElementById('detailMaturitySection').style.display = 'none';
    }

    var canModify = canEdit() && a.status !== 'closed';
    document.getElementById('detailEditBtn').style.display = canModify ? 'inline-flex' : 'none';
    document.getElementById('detailCloseBtn').style.display = canModify ? 'inline-flex' : 'none';

    document.getElementById('histType').value = '';
    var now = new Date();
    document.getElementById('histFrom').value = new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().split('T')[0];
    document.getElementById('histTo').value = todayISO();

    loadHistory();
    openModal('detailModal');
  };

  window.loadHistory = async function() {
    if (!currentDetailAccountId) return;
    var from = document.getElementById('histFrom').value;
    var to = document.getElementById('histTo').value;
    var type = document.getElementById('histType').value;

    var q = supabase.from('savings_transactions').select('*').eq('account_id', currentDetailAccountId).order('transaction_date', { ascending: false }).order('created_at', { ascending: false });
    if (from) q = q.gte('transaction_date', from);
    if (to) q = q.lte('transaction_date', to);
    if (type) q = q.eq('type', type);

    var r = await q;
    var tbody = document.getElementById('historyBody');
    if (!r.data || !r.data.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#94a3b8;">ไม่มีประวัติ</td></tr>';
      return;
    }

    var typeMap = {
      deposit: '<span class="badge badge-success">\uD83D\uDCB0 ฝากเงิน</span>',
      withdrawal: '<span class="badge badge-danger">\uD83D\uDCB8 ถอนเงิน</span>',
      interest: '<span class="badge badge-info">\uD83D\uDCC8 ดอกเบี้ย</span>',
      adjustment: '<span class="badge badge-gray">\u2699\uFE0F ปรับปรุง</span>'
    };

    tbody.innerHTML = r.data.map(function(t) {
      var isPositive = t.type === 'deposit' || t.type === 'interest';
      return '<tr>' +
        '<td style="white-space:nowrap;font-size:12px;">' + formatDate(t.transaction_date) + '</td>' +
        '<td>' + (typeMap[t.type] || t.type) + (t.note ? '<br><small style="color:#94a3b8;">' + t.note + '</small>' : '') + '</td>' +
        '<td class="text-right ' + (isPositive ? 'text-income' : 'text-expense') + '">' + (isPositive ? '+' : '-') + APP.t('baht') + formatMoney(t.amount) + '</td>' +
        '<td class="text-right" style="font-weight:600;">' + APP.t('baht') + formatMoney(t.balance_after) + '</td>' +
      '</tr>';
    }).join('');
  };

  window.closeAccountAction = async function() {
    if (!currentDetailAccountId) return;
    var a = allAccounts.find(function(x) { return x.id === currentDetailAccountId; });
    if (!a) return;
    if (!confirm('ปิดบัญชี "' + a.account_name + '" ใช่หรือไม่?\nดอกเบี้ยสะสมจะถูกบันทึกเป็นรายการสุดท้าย')) return;

    var interest = calculateAccruedInterest(a);
    if (interest > 0.01) {
      await supabase.from('savings_transactions').insert([{
        account_id: a.id,
        type: 'interest',
        amount: interest,
        balance_after: Number(a.principal_balance) + interest,
        transaction_date: todayISO(),
        note: 'ดอกเบี้ยสะสมเมื่อปิดบัญชี',
        created_by: APP.user.id
      }]);
    }

    var result = await supabase.from('savings_accounts').update({
      status: 'closed',
      principal_balance: Number(a.principal_balance) + interest
    }).eq('id', a.id);

    if (result.error) { showToast('เกิดข้อผิดพลาด', 'error'); return; }
    showToast('ปิดบัญชีสำเร็จ');
    closeModal('detailModal');
    loadAccounts();
  };

  window.openSimulatorModal = function() {
    document.getElementById('simPrincipal').value = '100000';
    document.getElementById('simMonths').value = '12';
    document.getElementById('simRate').value = '3.5';
    document.getElementById('simRateType').value = 'yearly';
    document.getElementById('simMethod').value = 'simple';
    document.getElementById('simMonthlyAdd').value = '';
    openModal('simulatorModal');
    runSimulation();
  };

  window.runSimulation = function() {
    var principal = parseFloat(document.getElementById('simPrincipal').value) || 0;
    var months = parseInt(document.getElementById('simMonths').value) || 0;
    var rate = parseFloat(document.getElementById('simRate').value) || 0;
    var rateType = document.getElementById('simRateType').value;
    var method = document.getElementById('simMethod').value;
    var monthlyAdd = parseFloat(document.getElementById('simMonthlyAdd').value) || 0;

    if (!principal || !months) {
      document.getElementById('simResultBox').style.display = 'none';
      document.getElementById('simChart').style.display = 'none';
      return;
    }

    var monthlyRate = getMonthlyRate(rate, rateType) / 100;
    var balance = principal;
    var totalDeposited = principal;
    var chartData = [balance];
    var chartLabels = ['เริ่มต้น'];

    for (var m = 1; m <= months; m++) {
      if (method === 'compound') {
        balance = balance * (1 + monthlyRate) + monthlyAdd;
        if (monthlyAdd > 0) totalDeposited += monthlyAdd;
      } else {
        balance = principal + monthlyAdd * m + (principal * monthlyRate * m) + (monthlyAdd > 0 ? (monthlyAdd * monthlyRate * (m * (m - 1) / 2)) : 0);
        if (monthlyAdd > 0) totalDeposited = principal + monthlyAdd * m;
      }
      chartData.push(balance);
      chartLabels.push('เดือน ' + m);
    }

    var finalTotal = balance;
    var finalInterest = finalTotal - totalDeposited;

    document.getElementById('simResultBox').style.display = 'block';
    document.getElementById('simOutPrincipal').textContent = APP.t('baht') + formatMoney(totalDeposited);
    document.getElementById('simOutInterest').textContent = '+' + APP.t('baht') + formatMoney(finalInterest);
    document.getElementById('simOutTotal').textContent = APP.t('baht') + formatMoney(finalTotal);

    var canvas = document.getElementById('simChart');
    canvas.style.display = 'block';
    if (simChartInst) simChartInst.destroy();
    simChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [{
          label: 'ยอดเงินสะสม',
          data: chartData,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,.15)',
          tension: .3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false, ticks: { callback: function(v) { return APP.t('baht') + formatMoney(v, 0); } } } }
      }
    });
  };

})();
