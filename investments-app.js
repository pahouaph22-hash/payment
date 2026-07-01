(function () {
  'use strict';

  var allInvestments = [];
  var allTx = [];
  var currentTypeFilter = 'all';
  var currentDetailId = null;
  var portfolioChartInst = null;
  var returnChartInst = null;
  var detailChartInst = null;
  var simInvChartInst = null;

  var TYPE_LABELS = { business:'ธุรกิจ', stock:'หุ้น', fund:'กองทุน', crypto:'คริปโต', property:'อสังหาฯ', gold:'ทองคำ', bond:'พันธบัตร', other:'อื่นๆ' };
  var TYPE_ICONS  = { business:'🏢', stock:'📈', fund:'💼', crypto:'₿', property:'🏠', gold:'🥇', bond:'📜', other:'💡' };
  var RISK_LABELS = { low:'ต่ำ', medium:'ปานกลาง', high:'สูง', very_high:'สูงมาก' };
  var TX_LABELS   = { deposit:'เพิ่มเงินลงทุน', return:'ผลตอบแทน', dividend:'เงินปันผล', withdrawal:'ถอนเงิน', fee:'ค่าธรรมเนียม', adjustment:'ปรับปรุง' };

  // ============================================
  // INIT
  // ============================================
  window.addEventListener('error', function (e) { console.error('Investments error:', e.error || e.message); });
  window.addEventListener('unhandledrejection', function (e) { console.error('Investments rejection:', e.reason); });

  checkAuth().then(function (session) {
    if (!session) return;
    try { initUI(); } catch (err) { console.error('initUI failed:', err); }
    loadAll().catch(function (err) { console.error('loadAll failed:', err); });
  }).catch(function (err) { console.error('checkAuth failed:', err); });

  function initUI() {
    var p = APP.profile;
    if (!p) return;
    document.getElementById('userAvatar').textContent = (p.full_name || 'U').charAt(0).toUpperCase();
    document.getElementById('userName').textContent = p.full_name || p.email;
    var roleMap = { admin: 'ผู้ดูแล', manager: 'ผู้จัดการ', accountant: 'นักบัญชี', viewer: 'ผู้ดู' };
    document.getElementById('userRole').textContent = roleMap[p.role] || p.role;
    if (p.role !== 'admin') document.querySelectorAll('.admin-only').forEach(function (el) { el.style.display = 'none'; });
    if (!canEdit()) {
      var btn = document.querySelector('.header-actions .btn-primary');
      if (btn) btn.style.display = 'none';
    }
    var now = new Date();
    document.getElementById('invHistFrom').value = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split('T')[0];
    document.getElementById('invHistTo').value = todayISO();
    document.getElementById('fInvStartDate').value = todayISO();
    document.getElementById('fTxInvDate').value = todayISO();
    if (window.innerWidth <= 768) document.querySelector('.menu-toggle').style.display = 'flex';
    window.addEventListener('resize', function () {
      var t = document.querySelector('.menu-toggle');
      if (t) t.style.display = window.innerWidth <= 768 ? 'flex' : 'none';
    });
  }

  window.toggleSidebar = function () {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('active');
  };

  // ============================================
  // LOAD ALL
  // ============================================
  async function loadAll() {
    var [invRes, txRes] = await Promise.all([
      supabase.from('investments').select('*').order('created_at', { ascending: false }),
      supabase.from('investment_transactions').select('*').order('date', { ascending: false })
    ]);
    allInvestments = invRes.data || [];
    allTx = txRes.data || [];

    renderHeroDashboard();
    renderCharts();
    filterInvestments();
  }

  // ============================================
  // HERO DASHBOARD
  // ============================================
  function renderHeroDashboard() {
    var totalPrincipal = 0, totalValue = 0;
    var todayReturn = 0, monthReturn = 0;
    var mStart = monthStart(), mEnd = monthEnd(), today = todayISO();
    var activeCount = 0;

    allInvestments.forEach(function (inv) {
      totalPrincipal += Number(inv.principal_amount);
      totalValue += Number(inv.current_value);
      if (inv.status === 'active') activeCount++;
    });

    allTx.forEach(function (t) {
      if (t.type === 'return' || t.type === 'dividend') {
        if (t.date === today) todayReturn += Number(t.amount);
        if (t.date >= mStart && t.date <= mEnd) monthReturn += Number(t.amount);
      }
    });

    var totalGain = totalValue - totalPrincipal;
    var totalROI = totalPrincipal > 0 ? (totalGain / totalPrincipal * 100) : 0;

    el('heroTotalValue').textContent = APP.t('baht') + formatMoney(totalValue);
    el('heroTotalGain').textContent = (totalGain >= 0 ? 'กำไร +' : 'ขาดทุน ') + APP.t('baht') + formatMoney(Math.abs(totalGain));
    el('heroROI').textContent = (totalROI >= 0 ? '+' : '') + totalROI.toFixed(2) + '%';
    el('heroROI').style.color = totalROI >= 0 ? '#10b981' : '#ef4444';
    el('heroROISub').textContent = 'จากเงินลงทุน ' + APP.t('baht') + formatMoney(totalPrincipal, 0);
    el('kpiTotalPrincipal').textContent = APP.t('baht') + formatMoney(totalPrincipal, 0);
    el('kpiTodayReturn').textContent = (todayReturn >= 0 ? '+' : '') + APP.t('baht') + formatMoney(todayReturn, 0);
    el('kpiMonthReturn').textContent = (monthReturn >= 0 ? '+' : '') + APP.t('baht') + formatMoney(monthReturn, 0);
    el('kpiCount').textContent = allInvestments.length;
    el('kpiCountSub').textContent = 'กำลังดำเนินการ ' + activeCount;
  }

  // ============================================
  // CHARTS
  // ============================================
  function renderCharts() {
    renderPortfolioChart();
    renderReturnChart();
  }

  function renderPortfolioChart() {
    var typeMap = {};
    allInvestments.forEach(function (inv) {
      var t = inv.type;
      typeMap[t] = (typeMap[t] || 0) + Number(inv.current_value);
    });

    var labels = Object.keys(typeMap).map(function (t) { return TYPE_ICONS[t] + ' ' + TYPE_LABELS[t]; });
    var values = Object.values(typeMap);
    var colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#64748b'];

    if (portfolioChartInst) portfolioChartInst.destroy();
    if (!values.length) return;
    portfolioChartInst = new Chart(el('portfolioChart'), {
      type: 'doughnut',
      data: { labels: labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2 }] },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
    });
  }

  function renderReturnChart() {
    // Group return/dividend transactions by month (last 12 months)
    var months = [];
    var now = new Date();
    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }
    var monthReturns = {};
    months.forEach(function (m) { monthReturns[m] = 0; });

    allTx.forEach(function (t) {
      if (t.type !== 'return' && t.type !== 'dividend') return;
      var mKey = t.date.substring(0, 7);
      if (monthReturns.hasOwnProperty(mKey)) monthReturns[mKey] += Number(t.amount);
    });

    var labels = months.map(function (m) { var p = m.split('-'); return p[1] + '/' + p[0].slice(2); });
    var values = months.map(function (m) { return monthReturns[m]; });

    if (returnChartInst) returnChartInst.destroy();
    returnChartInst = new Chart(el('returnChart'), {
      type: 'bar',
      data: { labels: labels, datasets: [{ label: 'ผลตอบแทน', data: values, backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 5 }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return APP.t('baht') + formatMoney(v, 0); } } } }
      }
    });
  }

  // ============================================
  // FILTER + RENDER CARDS
  // ============================================
  window.setTypeFilter = function (type) {
    currentTypeFilter = type;
    document.querySelectorAll('.inv-type-tabs .inv-type-tab').forEach(function (t) { t.classList.remove('active'); });
    var tabEl = el('tf_' + type);
    if (tabEl) tabEl.classList.add('active');
    filterInvestments();
  };

  window.filterInvestments = function () {
    var search = (el('invSearch').value || '').toLowerCase().trim();
    var status = el('invStatus').value;
    var sort = el('invSort').value;

    var list = allInvestments.filter(function (inv) {
      if (currentTypeFilter !== 'all' && inv.type !== currentTypeFilter) return false;
      if (status && inv.status !== status) return false;
      if (search && !(inv.name.toLowerCase().includes(search) || (inv.description || '').toLowerCase().includes(search))) return false;
      return true;
    });

    list.sort(function (a, b) {
      if (sort === 'value_desc') return Number(b.current_value) - Number(a.current_value);
      if (sort === 'roi_desc') return getROI(b) - getROI(a);
      if (sort === 'gain_desc') return (Number(b.current_value) - Number(b.principal_amount)) - (Number(a.current_value) - Number(a.principal_amount));
      if (sort === 'name_asc') return a.name.localeCompare(b.name, 'th');
      if (sort === 'date_desc') return b.start_date.localeCompare(a.start_date);
      return 0;
    });

    renderCards(list);
  };

  function getROI(inv) {
    var p = Number(inv.principal_amount);
    if (p <= 0) return 0;
    return (Number(inv.current_value) - p) / p * 100;
  }

  function getAnnualROI(inv) {
    var roi = getROI(inv);
    var startD = new Date(inv.start_date);
    var endD = inv.status === 'active' ? new Date() : (inv.end_date ? new Date(inv.end_date) : new Date());
    var years = (endD - startD) / (365.25 * 24 * 3600 * 1000);
    if (years <= 0) return roi;
    return roi / years;
  }

  function renderCards(list) {
    var grid = el('invGrid');
    if (!list.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#94a3b8;"><div style="font-size:48px;margin-bottom:12px;">📊</div><div>ยังไม่มีการลงทุน</div><div style="font-size:13px;margin-top:8px;">คลิก "เพิ่มการลงทุน" เพื่อเริ่มต้น</div></div>';
      return;
    }

    grid.innerHTML = list.map(function (inv) {
      var gain = Number(inv.current_value) - Number(inv.principal_amount);
      var roi = getROI(inv);
      var isPos = gain >= 0;
      var pct = Number(inv.principal_amount) > 0 ? Math.min(Number(inv.current_value) / Number(inv.principal_amount) * 100, 200) : 0;
      var riskClass = 'risk-' + (inv.risk_level || 'medium');
      var riskLabel = RISK_LABELS[inv.risk_level] || inv.risk_level;
      var statusLabel = inv.status === 'active' ? '🟢 ใช้งาน' : inv.status === 'closed' ? '📦 ปิดแล้ว' : '⏸ ระงับ';
      var annualROI = getAnnualROI(inv);

      return '<div class="inv-card" style="border-left-color:' + (inv.color || '#6366f1') + ';">' +
        '<div class="inv-card-top">' +
          '<div><div class="inv-card-name">' + inv.name + '</div>' +
          '<div class="inv-card-type">' + TYPE_ICONS[inv.type] + ' ' + TYPE_LABELS[inv.type] + ' • ' + statusLabel + '</div></div>' +
          '<div class="inv-card-icon">' + (inv.icon || TYPE_ICONS[inv.type]) + '</div>' +
        '</div>' +
        '<div class="inv-card-value">' + APP.t('baht') + formatMoney(inv.current_value, 0) + '</div>' +
        '<div class="inv-card-gain ' + (isPos ? 'positive' : 'negative') + '">' +
          (isPos ? '▲' : '▼') + ' ' + APP.t('baht') + formatMoney(Math.abs(gain), 0) +
          ' (' + (isPos ? '+' : '') + roi.toFixed(2) + '%) ' +
          '<span style="font-size:10px;opacity:.7;">ROI/ปี ' + annualROI.toFixed(1) + '%</span>' +
        '</div>' +
        '<div class="inv-card-bar"><div class="inv-card-bar-fill" style="width:' + Math.min(pct, 100) + '%;background:' + (isPos ? '#10b981' : '#ef4444') + ';"></div></div>' +
        '<div class="inv-card-footer">' +
          '<span>เงินลงทุน: ' + APP.t('baht') + formatMoney(inv.principal_amount, 0) + '</span>' +
          '<span class="risk-badge ' + riskClass + '">' + riskLabel + '</span>' +
        '</div>' +
        '<div class="inv-card-actions">' +
          '<button onclick="openDetail(\'' + inv.id + '\')">👁️ รายละเอียด</button>' +
          (canEdit() && inv.status === 'active' ? '<button onclick="openTxModal(\'' + inv.id + '\',\'return\')">📈 บันทึกผลตอบแทน</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  // ============================================
  // ADD / EDIT INVESTMENT
  // ============================================
  var TYPE_ICON_DEFAULTS = { business:'🏢', stock:'📈', fund:'💼', crypto:'₿', property:'🏠', gold:'🥇', bond:'📜', other:'💡' };

  window.setInvType = function (type) {
    el('fInvType').value = type;
    document.querySelectorAll('#invModal .inv-type-tab').forEach(function (b) { b.classList.remove('active'); });
    var btn = el('it_' + type);
    if (btn) btn.classList.add('active');
    if (!el('invEditId').value) el('fInvIcon').value = TYPE_ICON_DEFAULTS[type] || '📈';
  };

  window.openInvModal = function () {
    el('invEditId').value = '';
    el('invModalTitle').textContent = '➕ เพิ่มการลงทุนใหม่';
    el('fInvName').value = '';
    el('fInvPrincipal').value = '';
    el('fInvCurrentValue').value = '';
    el('fInvTargetReturn').value = '';
    el('fInvRisk').value = 'medium';
    el('fInvStartDate').value = todayISO();
    el('fInvEndDate').value = '';
    el('fInvDesc').value = '';
    el('fInvIcon').value = '🏢';
    el('fInvColor').value = '#6366f1';
    setInvType('business');
    openModal('invModal');
  };

  window.editFromDetail = function () {
    closeModal('invDetailModal');
    var inv = allInvestments.find(function (x) { return x.id === currentDetailId; });
    if (!inv) return;
    el('invEditId').value = inv.id;
    el('invModalTitle').textContent = '✏️ แก้ไขการลงทุน';
    el('fInvName').value = inv.name;
    el('fInvPrincipal').value = inv.principal_amount;
    el('fInvCurrentValue').value = inv.current_value;
    el('fInvTargetReturn').value = inv.target_return_rate || '';
    el('fInvRisk').value = inv.risk_level || 'medium';
    el('fInvStartDate').value = inv.start_date;
    el('fInvEndDate').value = inv.end_date || '';
    el('fInvDesc').value = inv.description || '';
    el('fInvIcon').value = inv.icon || TYPE_ICON_DEFAULTS[inv.type];
    el('fInvColor').value = inv.color || '#6366f1';
    setInvType(inv.type);
    openModal('invModal');
  };

  window.saveInvestment = async function () {
    var name = el('fInvName').value.trim();
    var principal = parseFloat(el('fInvPrincipal').value);
    var type = el('fInvType').value;
    var startDate = el('fInvStartDate').value;

    if (!name) { showToast('กรุณาระบุชื่อโครงการ', 'error'); return; }
    if (isNaN(principal) || principal <= 0) { showToast('กรุณาระบุเงินลงทุนที่ถูกต้อง', 'error'); return; }
    if (!startDate) { showToast('กรุณาระบุวันที่เริ่มลงทุน', 'error'); return; }

    var currentVal = parseFloat(el('fInvCurrentValue').value);
    if (isNaN(currentVal)) currentVal = principal;

    var data = {
      name: name,
      type: type,
      description: el('fInvDesc').value.trim() || null,
      principal_amount: principal,
      current_value: currentVal,
      target_return_rate: parseFloat(el('fInvTargetReturn').value) || 0,
      risk_level: el('fInvRisk').value,
      start_date: startDate,
      end_date: el('fInvEndDate').value || null,
      icon: el('fInvIcon').value || TYPE_ICON_DEFAULTS[type],
      color: el('fInvColor').value
    };

    var editId = el('invEditId').value;
    var result;
    try {
      if (editId) {
        result = await supabase.from('investments').update(data).eq('id', editId);
      } else {
        data.created_by = APP.user.id;
        data.status = 'active';
        result = await supabase.from('investments').insert([data]).select().single();
      }
      if (result.error) throw result.error;

      // If new investment, log initial deposit transaction
      if (!editId && result.data) {
        await supabase.from('investment_transactions').insert([{
          investment_id: result.data.id,
          type: 'deposit',
          amount: principal,
          date: startDate,
          note: 'เงินลงทุนเริ่มต้น',
          created_by: APP.user.id
        }]);
      }

      showToast(editId ? 'แก้ไขสำเร็จ ✅' : 'เพิ่มการลงทุนสำเร็จ ✅');
      closeModal('invModal');
      await loadAll();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // ============================================
  // TRANSACTION MODAL
  // ============================================
  window.setTxType = function (type) {
    el('fTxInvType').value = type;
    document.querySelectorAll('#txInvModal .inv-type-tab').forEach(function (b) { b.classList.remove('active'); });
    var btn = el('tt_' + type);
    if (btn) btn.classList.add('active');
    // Show unit fields for stock/crypto context
    el('txUnitSection').style.display = (type === 'deposit' || type === 'withdrawal') ? 'block' : 'none';
  };

  window.openTxModal = function (invId, txType) {
    var inv = allInvestments.find(function (x) { return x.id === invId; });
    if (!inv) return;
    el('txInvId').value = invId;
    el('txInvTitle').textContent = inv.icon + ' ' + inv.name;
    el('txInvCurrentVal').textContent = APP.t('baht') + formatMoney(inv.current_value);
    el('fTxInvAmount').value = '';
    el('fTxInvDate').value = todayISO();
    el('fTxInvPrice').value = '';
    el('fTxInvUnits').value = '';
    el('fTxInvNewValue').value = '';
    el('fTxInvNote').value = '';
    setTxType(txType || 'deposit');
    openModal('txInvModal');
  };

  window.openTxFromDetail = function (txType) {
    closeModal('invDetailModal');
    openTxModal(currentDetailId, txType);
  };

  window.openValuationUpdate = function () {
    var inv = allInvestments.find(function (x) { return x.id === currentDetailId; });
    if (!inv) return;
    var newVal = prompt('อัปเดตมูลค่าปัจจุบันของ "' + inv.name + '" (₭):\nมูลค่าปัจจุบัน: ' + formatMoney(inv.current_value));
    if (!newVal || isNaN(parseFloat(newVal))) return;
    supabase.from('investments').update({ current_value: parseFloat(newVal) }).eq('id', inv.id).then(function (r) {
      if (r.error) { showToast('เกิดข้อผิดพลาด', 'error'); return; }
      supabase.from('investment_valuations').insert([{
        investment_id: inv.id, value: parseFloat(newVal), valuation_date: todayISO(),
        note: 'อัปเดตมูลค่า', created_by: APP.user.id
      }]);
      showToast('อัปเดตมูลค่าสำเร็จ ✅');
      loadAll().then(function () { openDetail(inv.id); });
    });
  };

  window.saveTxInv = async function () {
    var invId = el('txInvId').value;
    var txType = el('fTxInvType').value;
    var amount = parseFloat(el('fTxInvAmount').value);
    var date = el('fTxInvDate').value || todayISO();
    var newValue = parseFloat(el('fTxInvNewValue').value);

    if (!amount || amount <= 0) { showToast('กรุณาระบุจำนวน', 'error'); return; }

    var inv = allInvestments.find(function (x) { return x.id === invId; });
    if (!inv) return;

    try {
      // Insert transaction record
      var txData = {
        investment_id: invId,
        type: txType,
        amount: amount,
        date: date,
        note: el('fTxInvNote').value.trim() || null,
        created_by: APP.user.id
      };
      var price = parseFloat(el('fTxInvPrice').value);
      var units = parseFloat(el('fTxInvUnits').value);
      if (!isNaN(price) && price > 0) txData.price_per_unit = price;
      if (!isNaN(units) && units > 0) txData.units = units;

      var r = await supabase.from('investment_transactions').insert([txData]);
      if (r.error) throw r.error;

      // Update investment current_value and principal if needed
      var updates = {};
      if (!isNaN(newValue) && newValue >= 0) {
        updates.current_value = newValue;
      } else if (txType === 'deposit') {
        updates.principal_amount = Number(inv.principal_amount) + amount;
        updates.current_value = Number(inv.current_value) + amount;
      } else if (txType === 'withdrawal') {
        updates.principal_amount = Math.max(0, Number(inv.principal_amount) - amount);
        updates.current_value = Math.max(0, Number(inv.current_value) - amount);
      } else if (txType === 'return' || txType === 'dividend') {
        updates.current_value = Number(inv.current_value) + amount;
      } else if (txType === 'fee') {
        updates.current_value = Math.max(0, Number(inv.current_value) - amount);
      }

      if (Object.keys(updates).length) {
        var ur = await supabase.from('investments').update(updates).eq('id', invId);
        if (ur.error) throw ur.error;
      }

      showToast('บันทึกสำเร็จ ✅');
      closeModal('txInvModal');
      await loadAll();
      if (currentDetailId === invId) openDetail(invId);
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // ============================================
  // DETAIL MODAL
  // ============================================
  window.openDetail = async function (id) {
    currentDetailId = id;
    var inv = allInvestments.find(function (x) { return x.id === id; });
    if (!inv) return;

    var gain = Number(inv.current_value) - Number(inv.principal_amount);
    var roi = getROI(inv);
    var annualROI = getAnnualROI(inv);
    var isPos = gain >= 0;

    // Calculate investment age in days/months/years
    var startD = new Date(inv.start_date);
    var nowD = new Date();
    var ageDays = Math.floor((nowD - startD) / 86400000);
    var ageStr = ageDays >= 365 ? (ageDays / 365).toFixed(1) + ' ปี' : ageDays >= 30 ? Math.floor(ageDays / 30) + ' เดือน' : ageDays + ' วัน';

    el('invDetailTitle').textContent = (inv.icon || TYPE_ICONS[inv.type]) + ' ' + inv.name;
    el('detailTypeBadge').textContent = TYPE_ICONS[inv.type] + ' ' + TYPE_LABELS[inv.type];
    el('detailCurrentVal').textContent = APP.t('baht') + formatMoney(inv.current_value);
    el('detailGainLabel').textContent = (isPos ? 'กำไร +' : 'ขาดทุน ') + APP.t('baht') + formatMoney(Math.abs(gain), 0) + ' (' + (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%)';
    el('detailROI').textContent = (roi >= 0 ? '+' : '') + roi.toFixed(2) + '%';
    el('detailROI').style.color = isPos ? '#10b981' : '#ef4444';

    el('detailPrincipal').textContent = APP.t('baht') + formatMoney(inv.principal_amount, 0);
    el('detailGain').textContent = (isPos ? '+' : '') + APP.t('baht') + formatMoney(gain, 0);
    el('detailGain').style.color = isPos ? '#10b981' : '#ef4444';
    el('detailAnnualROI').textContent = (annualROI >= 0 ? '+' : '') + annualROI.toFixed(2) + '%/ปี';

    var riskMap = { low:'🟢 ต่ำ', medium:'🟡 ปานกลาง', high:'🔴 สูง', very_high:'🔥 สูงมาก' };
    el('detailRisk').textContent = riskMap[inv.risk_level] || inv.risk_level;
    el('detailStartDate').textContent = formatDate(inv.start_date);
    el('detailAge').textContent = ageStr;

    if (inv.description) {
      el('detailDescSection').style.display = 'block';
      el('detailDescSection').textContent = inv.description;
    } else {
      el('detailDescSection').style.display = 'none';
    }

    var canModify = canEdit() && inv.status === 'active';
    el('detailEditBtn').style.display = canEdit() ? 'inline-flex' : 'none';
    el('detailCloseBtn').style.display = canModify ? 'inline-flex' : 'none';

    await loadInvHistory();
    openModal('invDetailModal');
  };

  window.loadInvHistory = async function () {
    if (!currentDetailId) return;
    var from = el('invHistFrom').value;
    var to = el('invHistTo').value;
    var type = el('invHistType').value;

    var q = supabase.from('investment_transactions').select('*').eq('investment_id', currentDetailId).order('date', { ascending: false }).order('created_at', { ascending: false });
    if (from) q = q.gte('date', from);
    if (to) q = q.lte('date', to);
    if (type) q = q.eq('type', type);

    var r = await q;
    var tbody = el('invHistoryBody');
    var txList = r.data || [];

    if (!txList.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">ไม่มีประวัติ</td></tr>';
      renderDetailChart([]);
      return;
    }

    var typeColors = { deposit:'badge-success', return:'badge-info', dividend:'badge-success', withdrawal:'badge-danger', fee:'badge-gray', adjustment:'badge-gray' };
    var isPositive = function (t) { return t === 'deposit' || t === 'return' || t === 'dividend'; };

    tbody.innerHTML = txList.map(function (t) {
      return '<tr>' +
        '<td style="white-space:nowrap;font-size:12px;">' + formatDate(t.date) + '</td>' +
        '<td><span class="badge ' + (typeColors[t.type] || 'badge-gray') + '">' + (TX_LABELS[t.type] || t.type) + '</span></td>' +
        '<td class="text-right ' + (isPositive(t.type) ? 'text-income' : 'text-expense') + '" style="font-weight:600;">' + (isPositive(t.type) ? '+' : '-') + APP.t('baht') + formatMoney(t.amount, 0) + '</td>' +
        '<td class="text-right">—</td>' +
        '<td style="font-size:11px;color:var(--gray-500);">' + (t.note || '') + '</td>' +
      '</tr>';
    }).join('');

    renderDetailChart(txList);
  };

  function renderDetailChart(txList) {
    var inv = allInvestments.find(function (x) { return x.id === currentDetailId; });
    if (!inv) return;

    // Build running value over time from transactions (oldest to newest)
    var sorted = txList.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    var labels = [];
    var values = [];
    var running = Number(inv.principal_amount);

    labels.push(formatDate(inv.start_date));
    values.push(running);

    sorted.forEach(function (t) {
      if (t.type === 'deposit') running += Number(t.amount);
      else if (t.type === 'withdrawal') running -= Number(t.amount);
      else if (t.type === 'return' || t.type === 'dividend') running += Number(t.amount);
      else if (t.type === 'fee') running -= Number(t.amount);
      labels.push(formatDate(t.date));
      values.push(Math.max(0, running));
    });

    labels.push('ปัจจุบัน');
    values.push(Number(inv.current_value));

    if (detailChartInst) detailChartInst.destroy();
    detailChartInst = new Chart(el('invDetailChart'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,.1)',
          tension: .3, fill: true, pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: false, ticks: { callback: function (v) { return APP.t('baht') + formatMoney(v, 0); } } } }
      }
    });
  }

  // ============================================
  // CLOSE INVESTMENT
  // ============================================
  window.closeInvestment = async function () {
    if (!currentDetailId) return;
    var inv = allInvestments.find(function (x) { return x.id === currentDetailId; });
    if (!inv) return;
    var gain = Number(inv.current_value) - Number(inv.principal_amount);
    var roi = getROI(inv);
    if (!confirm('ปิดการลงทุน "' + inv.name + '"?\n' +
      'กำไร/ขาดทุน: ' + (gain >= 0 ? '+' : '') + formatMoney(gain, 0) + ' ₭\n' +
      'ROI: ' + roi.toFixed(2) + '%')) return;

    try {
      var r = await supabase.from('investments').update({ status: 'closed', end_date: todayISO() }).eq('id', inv.id);
      if (r.error) throw r.error;
      showToast('ปิดการลงทุนสำเร็จ');
      closeModal('invDetailModal');
      await loadAll();
    } catch (err) {
      showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
    }
  };

  // ============================================
  // EXPORT EXCEL
  // ============================================
  window.exportExcel = function () {
    try {
      if (!allInvestments.length) { showToast('ไม่มีข้อมูลการลงทุน', 'error'); return; }
      var rows = allInvestments.map(function (inv) {
        var gain = Number(inv.current_value) - Number(inv.principal_amount);
        return {
          'ชื่อโครงการ': inv.name,
          'ประเภท': TYPE_LABELS[inv.type],
          'เงินลงทุน (₭)': Number(inv.principal_amount),
          'มูลค่าปัจจุบัน (₭)': Number(inv.current_value),
          'กำไร/ขาดทุน (₭)': gain,
          'ROI (%)': getROI(inv).toFixed(2),
          'ROI ต่อปี (%)': getAnnualROI(inv).toFixed(2),
          'ความเสี่ยง': RISK_LABELS[inv.risk_level],
          'วันที่เริ่ม': inv.start_date,
          'สถานะ': inv.status,
          'หมายเหตุ': inv.description || ''
        };
      });
      exportToExcel(rows, 'investments_' + todayISO());
      showToast('ส่งออก Excel สำเร็จ ✅');
    } catch (err) {
      showToast('ส่งออกล้มเหลว: ' + err.message, 'error');
    }
  };

  // ============================================
  // SIMULATOR
  // ============================================
  window.openSimulator = function () {
    el('simInvPrincipal').value = '1000000';
    el('simInvYears').value = '5';
    el('simInvRate').value = '15';
    el('simInvAnnualAdd').value = '';
    el('simInvMethod').value = 'compound';
    openModal('simInvModal');
    runInvSim();
  };

  window.runInvSim = function () {
    var principal = parseFloat(el('simInvPrincipal').value) || 0;
    var years = parseInt(el('simInvYears').value) || 0;
    var rate = parseFloat(el('simInvRate').value) || 0;
    var annualAdd = parseFloat(el('simInvAnnualAdd').value) || 0;
    var method = el('simInvMethod').value;

    if (!principal || !years || !rate) {
      el('simInvResult').style.display = 'none';
      el('simInvChart').style.display = 'none';
      el('simInvTable').style.display = 'none';
      return;
    }

    var r = rate / 100;
    var yearData = [];
    var totalPrincipal = principal;
    var value = principal;

    for (var y = 1; y <= years; y++) {
      var prevVal = value;
      if (method === 'compound') {
        value = value * (1 + r) + annualAdd;
      } else {
        value = principal * (1 + r * y) + annualAdd * y;
      }
      if (annualAdd > 0 && y > 1) totalPrincipal += annualAdd;
      yearData.push({ year: y, principal: totalPrincipal, value: value, gain: value - totalPrincipal });
    }

    var finalGain = value - totalPrincipal;
    var finalROI = totalPrincipal > 0 ? (finalGain / totalPrincipal * 100) : 0;

    el('simInvResult').style.display = 'block';
    el('simInvOutPrincipal').textContent = APP.t('baht') + formatMoney(totalPrincipal, 0);
    el('simInvOutGain').textContent = '+' + APP.t('baht') + formatMoney(finalGain, 0);
    el('simInvOutTotal').textContent = APP.t('baht') + formatMoney(value, 0);
    el('simInvOutROI').textContent = 'ROI รวม: +' + finalROI.toFixed(2) + '% | ผลตอบแทนต่อปี: ' + rate + '%';

    // Chart
    var chartLabels = ['เริ่มต้น'].concat(yearData.map(function (d) { return 'ปีที่ ' + d.year; }));
    var chartValues = [principal].concat(yearData.map(function (d) { return d.value; }));
    var principalLine = [principal].concat(yearData.map(function (d) { return d.principal; }));

    var canvas = el('simInvChart');
    canvas.style.display = 'block';
    if (simInvChartInst) simInvChartInst.destroy();
    simInvChartInst = new Chart(canvas, {
      type: 'line',
      data: {
        labels: chartLabels,
        datasets: [
          { label: 'มูลค่าพอร์ต', data: chartValues, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,.1)', tension: .3, fill: true },
          { label: 'เงินลงทุน', data: principalLine, borderColor: '#6366f1', borderDash: [4, 4], pointRadius: 0, fill: false }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } },
        scales: { y: { beginAtZero: false, ticks: { callback: function (v) { return APP.t('baht') + formatMoney(v, 0); } } } }
      }
    });

    // Year table
    el('simInvTable').style.display = 'block';
    el('simInvYearBody').innerHTML = yearData.map(function (d) {
      return '<tr>' +
        '<td style="text-align:center;">ปีที่ ' + d.year + '</td>' +
        '<td class="text-right">' + APP.t('baht') + formatMoney(d.principal, 0) + '</td>' +
        '<td class="text-right text-income">+' + APP.t('baht') + formatMoney(d.gain, 0) + '</td>' +
        '<td class="text-right" style="font-weight:700;">' + APP.t('baht') + formatMoney(d.value, 0) + '</td>' +
      '</tr>';
    }).join('');
  };

  // ============================================
  // HELPERS
  // ============================================
  function el(id) { return document.getElementById(id); }

})();
