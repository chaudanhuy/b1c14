const loginView = document.querySelector('#loginView');
const dashboardView = document.querySelector('#dashboardView');
const loginForm = document.querySelector('#loginForm');
const loginButton = document.querySelector('#loginButton');
const loginMessage = document.querySelector('#loginMessage');
const passwordInput = document.querySelector('#adminPassword');
const refreshButton = document.querySelector('#refreshDashboard');
const logoutButton = document.querySelector('#logoutButton');
const dashboardMessage = document.querySelector('#dashboardMessage');
const sectionsEl = document.querySelector('#squadSections');
const searchInput = document.querySelector('#searchInput');
const imageDialog = document.querySelector('#imageDialog');
const dialogImage = document.querySelector('#dialogImage');
const dialogCaption = document.querySelector('#dialogCaption');
const closeImageDialog = document.querySelector('#closeImageDialog');

let submissions = [];
let activeSquad = 'all';
let refreshTimer = null;
const IS_LOCAL_FILE = window.location.protocol === 'file:';

function setLoginMessage(text, type = '') {
  loginMessage.className = `form-message ${type}`.trim();
  loginMessage.textContent = text;
}

function setDashboardMessage(text, type = '') {
  dashboardMessage.className = `form-message ${type}`.trim();
  dashboardMessage.textContent = text;
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  if (!refreshTimer) refreshTimer = setInterval(loadDashboard, 15000);
}

function showLogin() {
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = null;
}

function formatTime(value) {
  if (!value) return 'Không rõ thời gian';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function updateMetrics() {
  document.querySelector('#adminTotal').textContent = submissions.length;
  for (const squad of [1, 2, 3]) {
    document.querySelector(`#adminS${squad}`).textContent = submissions.filter(item => item.squad === squad).length;
  }
}

function createSubmissionCard(item) {
  const card = document.createElement('article');
  card.className = 'submission-card';

  const imageButton = document.createElement('button');
  imageButton.type = 'button';
  imageButton.className = 'evidence-button';
  imageButton.setAttribute('aria-label', `Xem ảnh của ${item.name}`);

  const image = document.createElement('img');
  image.loading = 'lazy';
  image.alt = `Minh chứng của ${item.name}`;
  image.src = `/api/admin/image?id=${encodeURIComponent(item.id)}&v=${encodeURIComponent(item.updated_at || '')}`;
  imageButton.appendChild(image);
  imageButton.addEventListener('click', () => {
    dialogImage.src = image.src;
    dialogCaption.textContent = `${item.name} · Tiểu đội ${item.squad} · ${formatTime(item.updated_at)}`;
    imageDialog.showModal();
  });

  const body = document.createElement('div');
  body.className = 'submission-card-body';

  const person = document.createElement('div');
  person.className = 'submission-person';
  const name = document.createElement('strong');
  name.textContent = item.name;
  const time = document.createElement('small');
  time.textContent = `Cập nhật: ${formatTime(item.updated_at)}`;
  person.append(name, time);

  const actions = document.createElement('div');
  actions.className = 'card-actions';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = 'Đã nộp';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete-button';
  remove.textContent = 'Xóa';
  remove.addEventListener('click', () => deleteSubmission(item));
  actions.append(badge, remove);

  body.append(person, actions);
  card.append(imageButton, body);
  return card;
}

function renderSections() {
  const query = searchInput.value.trim().toLocaleLowerCase('vi-VN');
  const filtered = submissions.filter(item => {
    const squadOk = activeSquad === 'all' || String(item.squad) === activeSquad;
    const searchOk = !query || item.name.toLocaleLowerCase('vi-VN').includes(query);
    return squadOk && searchOk;
  });

  sectionsEl.replaceChildren();
  const squads = activeSquad === 'all' ? [1, 2, 3] : [Number(activeSquad)];

  for (const squad of squads) {
    const items = filtered.filter(item => item.squad === squad);
    const section = document.createElement('section');
    section.className = 'squad-section';

    const head = document.createElement('div');
    head.className = 'squad-section-head';
    const title = document.createElement('h2');
    title.textContent = `Tiểu đội ${squad}`;
    const count = document.createElement('span');
    count.textContent = `${items.length} người đã nộp`;
    head.append(title, count);

    section.appendChild(head);
    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = query ? 'Không tìm thấy học viên phù hợp.' : 'Chưa có học viên nào nộp.';
      section.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'submission-grid';
      items.forEach(item => grid.appendChild(createSubmissionCard(item)));
      section.appendChild(grid);
    }
    sectionsEl.appendChild(section);
  }
}

async function loadDashboard() {
  setDashboardMessage('Đang cập nhật dữ liệu...');
  try {
    const response = await fetch('/api/admin/submissions', { cache: 'no-store' });
    if (response.status === 401) {
      showLogin();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không tải được dữ liệu.');
    submissions = data.submissions || [];
    updateMetrics();
    renderSections();
    setDashboardMessage(`Đã cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`);
  } catch (error) {
    setDashboardMessage(error.message || 'Có lỗi khi tải dữ liệu.', 'error');
  }
}

async function deleteSubmission(item) {
  const ok = confirm(`Xóa bản nộp của ${item.name} - Tiểu đội ${item.squad}?`);
  if (!ok) return;
  try {
    const response = await fetch(`/api/admin/submissions?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể xóa.');
    await loadDashboard();
  } catch (error) {
    setDashboardMessage(error.message || 'Không thể xóa bản nộp.', 'error');
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    setLoginMessage('Bạn đang xem bản local. Đăng nhập và dữ liệu thật chỉ hoạt động khi chạy trên Cloudflare Pages.', 'error');
    return;
  }
  loginButton.disabled = true;
  setLoginMessage('Đang kiểm tra...');
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Đăng nhập thất bại.');
    passwordInput.value = '';
    setLoginMessage('');
    showDashboard();
    await loadDashboard();
  } catch (error) {
    setLoginMessage(error.message || 'Sai mật khẩu hoặc có lỗi kết nối.', 'error');
  } finally {
    loginButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadDashboard);
logoutButton.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  submissions = [];
  showLogin();
});
searchInput.addEventListener('input', renderSections);
document.querySelectorAll('.filter-tab').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(item => item.classList.remove('active'));
    button.classList.add('active');
    activeSquad = button.dataset.squad;
    renderSections();
  });
});
closeImageDialog.addEventListener('click', () => imageDialog.close());
imageDialog.addEventListener('click', event => {
  if (event.target === imageDialog) imageDialog.close();
});

(async function boot() {
  if (IS_LOCAL_FILE) {
    showLogin();
    setLoginMessage('Bản xem giao diện local · backend sẽ hoạt động sau khi triển khai Cloudflare Pages.');
    return;
  }
  try {
    const response = await fetch('/api/admin/status', { cache: 'no-store' });
    if (response.ok) {
      showDashboard();
      await loadDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
})();
