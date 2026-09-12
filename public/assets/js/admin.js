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
const adminTaskSelect = document.querySelector('#adminTaskSelect');
const createTaskForm = document.querySelector('#createTaskForm');
const newTaskTitle = document.querySelector('#newTaskTitle');
const taskMessage = document.querySelector('#taskMessage');
const toggleTaskButton = document.querySelector('#toggleTaskButton');
const exportZipButton = document.querySelector('#exportZipButton');
const galleryDialog = document.querySelector('#galleryDialog');
const closeGalleryDialog = document.querySelector('#closeGalleryDialog');
const galleryTitle = document.querySelector('#galleryTitle');
const galleryMeta = document.querySelector('#galleryMeta');
const galleryMainImage = document.querySelector('#galleryMainImage');
const galleryThumbs = document.querySelector('#galleryThumbs');
const deleteCurrentImage = document.querySelector('#deleteCurrentImage');

let tasks = [];
let submissions = [];
let activeSquad = 'all';
let refreshTimer = null;
let currentGallerySubmission = null;
let currentGalleryImages = [];
let currentImageIndex = 0;
const IS_LOCAL_FILE = window.location.protocol === 'file:';

function setLoginMessage(text, type = '') {
  loginMessage.className = `form-message ${type}`.trim();
  loginMessage.textContent = text;
}
function setDashboardMessage(text, type = '') {
  dashboardMessage.className = `form-message ${type}`.trim();
  dashboardMessage.textContent = text;
}
function setTaskMessage(text, type = '') {
  taskMessage.className = `form-message ${type}`.trim();
  taskMessage.textContent = text;
}

function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  if (!refreshTimer) refreshTimer = setInterval(() => loadDashboard(false), 15000);
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

function selectedTask() {
  const id = Number(adminTaskSelect.value);
  return tasks.find(task => Number(task.id) === id) || null;
}

function renderTaskOptions(preferredId = null) {
  const current = preferredId || Number(adminTaskSelect.value) || Number(tasks[0]?.id || 0);
  adminTaskSelect.replaceChildren();

  if (!tasks.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chưa có task nào';
    adminTaskSelect.appendChild(option);
    adminTaskSelect.disabled = true;
    toggleTaskButton.disabled = true;
    exportZipButton.disabled = true;
    return;
  }

  adminTaskSelect.disabled = false;
  for (const task of tasks) {
    const option = document.createElement('option');
    option.value = String(task.id);
    option.textContent = `${task.title}${Number(task.is_active) ? '' : ' · đã đóng'}`;
    if (Number(task.id) === Number(current)) option.selected = true;
    adminTaskSelect.appendChild(option);
  }
  updateTaskButtons();
}

function updateTaskButtons() {
  const task = selectedTask();
  const hasTask = Boolean(task);
  toggleTaskButton.disabled = !hasTask;
  exportZipButton.disabled = !hasTask;
  toggleTaskButton.textContent = hasTask && Number(task.is_active) ? 'Đóng nhận bài' : 'Mở nhận bài';
  toggleTaskButton.classList.toggle('task-open-button', hasTask && !Number(task.is_active));
}

async function loadTasks(preferredId = null) {
  const response = await fetch('/api/admin/tasks', { cache: 'no-store' });
  if (response.status === 401) {
    showLogin();
    return false;
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Không tải được danh sách task.');
  tasks = data.tasks || [];
  renderTaskOptions(preferredId);
  return true;
}

function updateMetrics() {
  document.querySelector('#adminTotal').textContent = submissions.length;
  for (const squad of [1, 2, 3]) {
    document.querySelector(`#adminS${squad}`).textContent = submissions.filter(item => Number(item.squad) === squad).length;
  }
}

function createPersonCard(item) {
  const card = document.createElement('article');
  card.className = 'person-card';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'person-open-button';
  open.setAttribute('aria-label', `Xem ${item.image_count} ảnh của ${item.name}`);

  const preview = document.createElement('div');
  preview.className = 'person-preview';
  if (item.preview_image_id) {
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = `/api/admin/image?id=${encodeURIComponent(item.preview_image_id)}&v=${encodeURIComponent(item.updated_at || '')}`;
    img.alt = `Ảnh đầu tiên của ${item.name}`;
    img.addEventListener('error', () => {
      img.remove();
      preview.textContent = 'Ảnh';
    });
    preview.appendChild(img);
  } else {
    preview.textContent = 'Ảnh';
  }

  const info = document.createElement('div');
  info.className = 'person-info';
  const name = document.createElement('strong');
  name.textContent = item.name;
  const meta = document.createElement('span');
  meta.textContent = `Cập nhật ${formatTime(item.updated_at)}`;
  const count = document.createElement('b');
  count.textContent = `${Number(item.image_count || 0)} ảnh`;
  info.append(name, meta, count);

  const arrow = document.createElement('span');
  arrow.className = 'person-arrow';
  arrow.textContent = '›';
  open.append(preview, info, arrow);
  open.addEventListener('click', () => openGallery(item));

  const footer = document.createElement('div');
  footer.className = 'person-card-footer';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = 'Đã nộp';
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'delete-button';
  remove.textContent = 'Xóa toàn bộ';
  remove.addEventListener('click', () => deleteSubmission(item));
  footer.append(badge, remove);

  card.append(open, footer);
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
    const items = filtered.filter(item => Number(item.squad) === squad);
    const section = document.createElement('section');
    section.className = 'squad-section';

    const head = document.createElement('div');
    head.className = 'squad-section-head';
    const title = document.createElement('h2');
    title.textContent = `Tiểu đội ${squad}`;
    const count = document.createElement('span');
    const imageCount = items.reduce((sum, item) => sum + Number(item.image_count || 0), 0);
    count.textContent = `${items.length} người · ${imageCount} ảnh`;
    head.append(title, count);
    section.appendChild(head);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = query ? 'Không tìm thấy học viên phù hợp.' : 'Chưa có học viên nào nộp.';
      section.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'person-grid';
      items.forEach(item => grid.appendChild(createPersonCard(item)));
      section.appendChild(grid);
    }
    sectionsEl.appendChild(section);
  }
}

async function loadDashboard(showLoading = true) {
  const task = selectedTask();
  if (!task) {
    submissions = [];
    updateMetrics();
    renderSections();
    setDashboardMessage('Hãy tạo một task để bắt đầu.');
    return;
  }

  if (showLoading) setDashboardMessage('Đang cập nhật dữ liệu...');
  try {
    const response = await fetch(`/api/admin/submissions?task_id=${encodeURIComponent(task.id)}`, { cache: 'no-store' });
    if (response.status === 401) {
      showLogin();
      return;
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không tải được dữ liệu.');
    submissions = data.submissions || [];
    updateMetrics();
    renderSections();
    setDashboardMessage(`Task: ${task.title} · cập nhật lúc ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`);
  } catch (error) {
    setDashboardMessage(error.message || 'Có lỗi khi tải dữ liệu.', 'error');
  }
}

async function openGallery(item) {
  currentGallerySubmission = item;
  currentGalleryImages = [];
  currentImageIndex = 0;
  galleryTitle.textContent = item.name;
  galleryMeta.textContent = `Tiểu đội ${item.squad} · đang tải ảnh...`;
  galleryThumbs.replaceChildren();
  galleryMainImage.removeAttribute('src');
  galleryDialog.showModal();

  try {
    const response = await fetch(`/api/admin/images?submission_id=${encodeURIComponent(item.id)}`, { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không tải được ảnh.');
    currentGalleryImages = data.images || [];
    galleryMeta.textContent = `Tiểu đội ${item.squad} · ${currentGalleryImages.length} ảnh minh chứng`;
    renderGallery();
  } catch (error) {
    galleryMeta.textContent = error.message || 'Không tải được ảnh.';
    deleteCurrentImage.disabled = true;
  }
}

function renderGallery() {
  galleryThumbs.replaceChildren();
  if (!currentGalleryImages.length) {
    galleryMainImage.removeAttribute('src');
    galleryMeta.textContent = 'Không còn ảnh minh chứng.';
    deleteCurrentImage.disabled = true;
    return;
  }

  currentImageIndex = Math.min(currentImageIndex, currentGalleryImages.length - 1);
  const current = currentGalleryImages[currentImageIndex];
  galleryMainImage.src = `/api/admin/image?id=${encodeURIComponent(current.id)}&v=${encodeURIComponent(current.created_at || '')}`;
  galleryMainImage.alt = current.image_name || `Ảnh ${currentImageIndex + 1}`;
  deleteCurrentImage.disabled = false;

  currentGalleryImages.forEach((image, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gallery-thumb ${index === currentImageIndex ? 'active' : ''}`;
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.src = `/api/admin/image?id=${encodeURIComponent(image.id)}&v=${encodeURIComponent(image.created_at || '')}`;
    img.alt = image.image_name || `Ảnh ${index + 1}`;
    const label = document.createElement('span');
    label.textContent = `${index + 1}`;
    button.append(img, label);
    button.addEventListener('click', () => {
      currentImageIndex = index;
      renderGallery();
    });
    galleryThumbs.appendChild(button);
  });
}

async function deleteSubmission(item) {
  const ok = confirm(`Xóa toàn bộ ${item.image_count} ảnh của ${item.name} trong task này?`);
  if (!ok) return;
  try {
    const response = await fetch(`/api/admin/submissions?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể xóa.');
    await loadTasks(item.task_id);
    await loadDashboard();
  } catch (error) {
    setDashboardMessage(error.message || 'Không thể xóa bản nộp.', 'error');
  }
}

async function deleteGalleryImage() {
  const image = currentGalleryImages[currentImageIndex];
  if (!image || !currentGallerySubmission) return;
  if (!confirm(`Xóa ảnh số ${currentImageIndex + 1} của ${currentGallerySubmission.name}?`)) return;

  deleteCurrentImage.disabled = true;
  try {
    const response = await fetch(`/api/admin/images?id=${encodeURIComponent(image.id)}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể xóa ảnh.');

    currentGalleryImages.splice(currentImageIndex, 1);
    if (currentImageIndex >= currentGalleryImages.length) currentImageIndex = Math.max(0, currentGalleryImages.length - 1);
    if (!currentGalleryImages.length) galleryDialog.close();
    else renderGallery();
    await loadTasks(currentGallerySubmission.task_id);
    await loadDashboard(false);
  } catch (error) {
    galleryMeta.textContent = error.message || 'Không thể xóa ảnh.';
    deleteCurrentImage.disabled = false;
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    setLoginMessage('Bản local chỉ xem giao diện. Đăng nhập và dữ liệu thật hoạt động trên Cloudflare Pages.', 'error');
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
    await loadTasks();
    await loadDashboard();
  } catch (error) {
    setLoginMessage(error.message || 'Sai mật khẩu hoặc có lỗi kết nối.', 'error');
  } finally {
    loginButton.disabled = false;
  }
});

createTaskForm.addEventListener('submit', async event => {
  event.preventDefault();
  const title = newTaskTitle.value.trim().replace(/\s+/g, ' ');
  if (title.length < 2) return setTaskMessage('Nhập tên task rõ ràng hơn.', 'error');
  setTaskMessage('Đang tạo task...');
  try {
    const response = await fetch('/api/admin/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể tạo task.');
    newTaskTitle.value = '';
    setTaskMessage('Đã tạo task mới và mở nhận bài.', 'success');
    await loadTasks(data.task?.id);
    await loadDashboard();
  } catch (error) {
    setTaskMessage(error.message || 'Không thể tạo task.', 'error');
  }
});

adminTaskSelect.addEventListener('change', async () => {
  updateTaskButtons();
  await loadDashboard();
});

toggleTaskButton.addEventListener('click', async () => {
  const task = selectedTask();
  if (!task) return;
  const next = Number(task.is_active) ? 0 : 1;
  try {
    const response = await fetch('/api/admin/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, is_active: Boolean(next) })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể cập nhật task.');
    setTaskMessage(next ? 'Đã mở lại task cho học viên nộp.' : 'Đã đóng task. Học viên sẽ không còn thấy task này.', 'success');
    await loadTasks(task.id);
  } catch (error) {
    setTaskMessage(error.message || 'Không thể cập nhật task.', 'error');
  }
});

exportZipButton.addEventListener('click', () => {
  const task = selectedTask();
  if (!task) return;
  setTaskMessage('Đang chuẩn bị file ZIP. Nếu task có nhiều ảnh, trình duyệt có thể mất một lúc để bắt đầu tải...');
  const link = document.createElement('a');
  link.href = `/api/admin/export?task_id=${encodeURIComponent(task.id)}`;
  link.download = '';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => setTaskMessage('Đã yêu cầu xuất ZIP.', 'success'), 800);
});

refreshButton.addEventListener('click', async () => {
  const id = Number(adminTaskSelect.value) || null;
  try {
    await loadTasks(id);
    await loadDashboard();
  } catch (error) {
    setDashboardMessage(error.message || 'Không thể làm mới.', 'error');
  }
});

logoutButton.addEventListener('click', async () => {
  await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
  tasks = [];
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

closeGalleryDialog.addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', event => {
  if (event.target === galleryDialog) galleryDialog.close();
});
deleteCurrentImage.addEventListener('click', deleteGalleryImage);

(async function boot() {
  if (IS_LOCAL_FILE) {
    showLogin();
    setLoginMessage('Bản xem giao diện local · backend hoạt động sau khi triển khai Cloudflare Pages.');
    return;
  }
  try {
    const response = await fetch('/api/admin/status', { cache: 'no-store' });
    if (response.ok) {
      showDashboard();
      await loadTasks();
      await loadDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
})();
