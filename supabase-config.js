// ============================================
// FINANCE APP - CONFIG & UTILITIES
// supabase-config.js
// ============================================

var SUPABASE_URL = 'https://maogarokogumawipnbct.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hb2dhcm9rb2d1bWF3aXBuYmN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI3MTc5NTQsImV4cCI6MjA5ODI5Mzk1NH0.rUTBjbuMCQgGLIYKE3AsvOktVtG3uCKJ0NwRv_7RNJ0';

var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// i18n TRANSLATIONS
// ============================================
var TRANSLATIONS = {
  th: {
    appName: 'ระบบบริหารการเงิน',
    dashboard: 'แดชบอร์ด',
    transactions: 'รายรับ-รายจ่าย',
    reports: 'รายงาน',
    cashflow: 'กระแสเงินสด',
    budget: 'งบประมาณ',
    debts: 'หนี้/ลูกหนี้',
    assets: 'ทรัพย์สิน',
    admin: 'ผู้ดูแลระบบ',
    income: 'รายรับ',
    expense: 'รายจ่าย',
    profit: 'กำไร',
    loss: 'ขาดทุน',
    balance: 'ยอดคงเหลือ',
    totalIncome: 'รายรับทั้งหมด',
    totalExpense: 'รายจ่ายทั้งหมด',
    netProfit: 'กำไรสุทธิ',
    thisMonth: 'เดือนนี้',
    thisYear: 'ปีนี้',
    today: 'วันนี้',
    date: 'วันที่',
    amount: 'จำนวน',
    category: 'หมวดหมู่',
    description: 'รายละเอียด',
    note: 'หมายเหตุ',
    save: 'บันทึก',
    cancel: 'ยกเลิก',
    delete: 'ลบ',
    edit: 'แก้ไข',
    add: 'เพิ่ม',
    search: 'ค้นหา',
    filter: 'กรอง',
    export: 'ส่งออก',
    exportExcel: 'ส่งออก Excel',
    exportPDF: 'ส่งออก PDF',
    login: 'เข้าสู่ระบบ',
    logout: 'ออกจากระบบ',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    loading: 'กำลังโหลด...',
    success: 'สำเร็จ',
    error: 'เกิดข้อผิดพลาด',
    confirm: 'ยืนยัน',
    confirmDelete: 'ยืนยันการลบ?',
    noData: 'ไม่มีข้อมูล',
    payable: 'เจ้าหนี้',
    receivable: 'ลูกหนี้',
    status: 'สถานะ',
    pending: 'รอดำเนินการ',
    completed: 'เสร็จสิ้น',
    paid: 'ชำระแล้ว',
    overdue: 'เกินกำหนด',
    partial: 'ชำระบางส่วน',
    cash: 'เงินสด',
    bank_transfer: 'โอนเงิน',
    credit_card: 'บัตรเครดิต',
    check: 'เช็ค',
    other: 'อื่น ๆ',
    admin_role: 'ผู้ดูแล',
    manager_role: 'ผู้จัดการ',
    accountant_role: 'นักบัญชี',
    viewer_role: 'ผู้ดูเท่านั้น',
    currency: 'บาท',
    baht: '฿',
  },
  lo: {
    appName: 'ລະບົບບໍລິຫານການເງິນ',
    dashboard: 'ໜ້າຫຼັກ',
    transactions: 'ລາຍຮັບ-ລາຍຈ່າຍ',
    reports: 'ລາຍງານ',
    cashflow: 'ກະແສເງິນສົດ',
    budget: 'ງົບປະມານ',
    debts: 'ໜີ້ສິນ/ລູກໜີ້',
    assets: 'ຊັບສິນ',
    admin: 'ຜູ້ດູແລລະບົບ',
    income: 'ລາຍຮັບ',
    expense: 'ລາຍຈ່າຍ',
    profit: 'ກຳໄລ',
    loss: 'ຂາດທຶນ',
    balance: 'ຍອດຄົງເຫຼືອ',
    totalIncome: 'ລາຍຮັບທັງໝົດ',
    totalExpense: 'ລາຍຈ່າຍທັງໝົດ',
    netProfit: 'ກຳໄລສຸດທິ',
    thisMonth: 'ເດືອນນີ້',
    thisYear: 'ປີນີ້',
    today: 'ມື້ນີ້',
    date: 'ວັນທີ',
    amount: 'ຈຳນວນ',
    category: 'ໝວດໝູ່',
    description: 'ລາຍລະອຽດ',
    note: 'ໝາຍເຫດ',
    save: 'ບັນທຶກ',
    cancel: 'ຍົກເລີກ',
    delete: 'ລຶບ',
    edit: 'ແກ້ໄຂ',
    add: 'ເພີ່ມ',
    search: 'ຄົ້ນຫາ',
    filter: 'ກັ່ນຕອງ',
    export: 'ສົ່ງອອກ',
    exportExcel: 'ສົ່ງອອກ Excel',
    exportPDF: 'ສົ່ງອອກ PDF',
    login: 'ເຂົ້າລະບົບ',
    logout: 'ອອກຈາກລະບົບ',
    email: 'ອີເມລ',
    password: 'ລະຫັດຜ່ານ',
    loading: 'ກຳລັງໂຫຼດ...',
    success: 'ສຳເລັດ',
    error: 'ເກີດຂໍ້ຜິດພາດ',
    confirm: 'ຢືນຢັນ',
    confirmDelete: 'ຢືນຢັນການລຶບ?',
    noData: 'ບໍ່ມີຂໍ້ມູນ',
    payable: 'ເຈົ້າໜີ້',
    receivable: 'ລູກໜີ້',
    status: 'ສະຖານະ',
    pending: 'ລໍຖ້າ',
    completed: 'ສຳເລັດ',
    paid: 'ຊຳລະແລ້ວ',
    overdue: 'ເກີນກຳນົດ',
    partial: 'ຊຳລະບາງສ່ວນ',
    cash: 'ເງິນສົດ',
    bank_transfer: 'ໂອນເງິນ',
    credit_card: 'ບັດເຄດິດ',
    check: 'ເຊັກ',
    other: 'ອື່ນໆ',
    admin_role: 'ຜູ້ດູແລ',
    manager_role: 'ຜູ້ຈັດການ',
    accountant_role: 'ນັກບັນຊີ',
    viewer_role: 'ຜູ້ເບິ່ງເທົ່ານັ້ນ',
    currency: 'ກີບ',
    baht: '₭',
  },
  en: {
    appName: 'Finance Management',
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    reports: 'Reports',
    cashflow: 'Cash Flow',
    budget: 'Budget',
    debts: 'Debts',
    assets: 'Assets',
    admin: 'Admin',
    income: 'Income',
    expense: 'Expense',
    profit: 'Profit',
    loss: 'Loss',
    balance: 'Balance',
    totalIncome: 'Total Income',
    totalExpense: 'Total Expense',
    netProfit: 'Net Profit',
    thisMonth: 'This Month',
    thisYear: 'This Year',
    today: 'Today',
    date: 'Date',
    amount: 'Amount',
    category: 'Category',
    description: 'Description',
    note: 'Note',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    exportExcel: 'Export Excel',
    exportPDF: 'Export PDF',
    login: 'Login',
    logout: 'Logout',
    email: 'Email',
    password: 'Password',
    loading: 'Loading...',
    success: 'Success',
    error: 'Error',
    confirm: 'Confirm',
    confirmDelete: 'Confirm Delete?',
    noData: 'No Data',
    payable: 'Payable',
    receivable: 'Receivable',
    status: 'Status',
    pending: 'Pending',
    completed: 'Completed',
    paid: 'Paid',
    overdue: 'Overdue',
    partial: 'Partial',
    cash: 'Cash',
    bank_transfer: 'Bank Transfer',
    credit_card: 'Credit Card',
    check: 'Check',
    other: 'Other',
    admin_role: 'Admin',
    manager_role: 'Manager',
    accountant_role: 'Accountant',
    viewer_role: 'Viewer',
    currency: 'THB',
    baht: '฿',
  }
};

// ============================================
// APP STATE
// ============================================
var APP = {
  lang: localStorage.getItem('finance_lang') || 'th',
  user: null,
  profile: null,
  t: function(key) {
    return (TRANSLATIONS[APP.lang] && TRANSLATIONS[APP.lang][key]) || key;
  },
  setLang: function(lang) {
    APP.lang = lang;
    localStorage.setItem('finance_lang', lang);
    document.documentElement.lang = lang;
  }
};

// ============================================
// AUTH HELPERS
// ============================================
async function checkAuth() {
  var result = await supabase.auth.getSession();
  var session = result.data.session;
  if (!session) {
    window.location.href = 'index.html';
    return null;
  }
  APP.user = session.user;
  var profileResult = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  if (profileResult.data) {
    APP.profile = profileResult.data;
    APP.setLang(profileResult.data.language || 'th');
  }
  return session;
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ============================================
// FORMAT HELPERS
// ============================================
function formatMoney(amount, decimals) {
  if (decimals === undefined) decimals = 2;
  if (!amount && amount !== 0) return '-';
  return Number(amount).toLocaleString('th-TH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  var d = new Date(dateStr);
  if (APP.lang === 'th') {
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
  } else if (APP.lang === 'lo') {
    return d.toLocaleDateString('lo-LA', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateInput(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().split('T')[0];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function monthStart() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

function monthEnd() {
  var d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

function yearStart() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
}

// ============================================
// UI HELPERS
// ============================================
function showToast(message, type) {
  if (type === undefined) type = 'success';
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = (type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️') + ' ' + message;
  document.body.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 3000);
}

function showLoading(el) {
  if (el) el.innerHTML = '<div class="loading-spinner"></div>';
}

function openModal(modalId) {
  var m = document.getElementById(modalId);
  if (m) m.classList.add('active');
}

function closeModal(modalId) {
  var m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
}

// ============================================
// EXPORT HELPERS
// ============================================
function exportToExcel(data, filename) {
  var wb = XLSX.utils.book_new();
  var ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, (filename || 'export') + '.xlsx');
}

async function exportToPDF(elementId, filename) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var canvas = await html2canvas(el, { scale: 2 });
  var imgData = canvas.toDataURL('image/png');
  var pdf = new jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  var w = pdf.internal.pageSize.getWidth();
  var h = (canvas.height * w) / canvas.width;
  pdf.addImage(imgData, 'PNG', 0, 0, w, h);
  pdf.save((filename || 'export') + '.pdf');
}

// ============================================
// ROLE CHECK
// ============================================
function canEdit() {
  return APP.profile && ['admin', 'manager', 'accountant'].includes(APP.profile.role);
}

function canAdmin() {
  return APP.profile && APP.profile.role === 'admin';
}

function canManage() {
  return APP.profile && ['admin', 'manager'].includes(APP.profile.role);
}
