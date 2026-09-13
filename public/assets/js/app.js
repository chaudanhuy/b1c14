const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 100 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  'png',
  'jpg',
  'jpeg',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx'
];

function getFileExtension(name = '') {
  return String(name)
    .split('.')
    .pop()
    .toLowerCase();
}

function isImageFile(file) {
  return String(
    file.type || ''
  ).startsWith('image/');
}

function getFileLabel(file) {
  const ext =
    getFileExtension(file.name);

  return (
    ext.toUpperCase() ||
    'FILE'
  );
}

const unitSelect = document.querySelector('#unitSelect');
const memberSelect = document.querySelector('#memberSelect');
const passwordInput = document.querySelector('#passwordInput');
const loginForm = document.querySelector('#loginForm');
const loginButton = document.querySelector('#loginButton');
const logoutButton = document.querySelector('#logoutButton');
const loginMessage = document.querySelector('#loginMessage');
const sessionPanel = document.querySelector('#sessionPanel');
const sessionGreeting = document.querySelector('#sessionGreeting');
const sessionMeta = document.querySelector('#sessionMeta');
const roleBadge = document.querySelector('#roleBadge');
const defaultPasswordBanner = document.querySelector('#defaultPasswordBanner');

const memberDashboard = document.querySelector('#memberDashboard');
const cadreDashboard = document.querySelector('#cadreDashboard');

const taskSelect = document.querySelector('#taskSelect');
const uploadForm = document.querySelector('#uploadForm');
const imagesInput = document.querySelector('#imagesInput');
const chooseFilesButton = document.querySelector('#chooseFilesButton');
const uploadBox = document.querySelector('#uploadBox');
const uploadTitle = document.querySelector('#uploadTitle');
const uploadHint = document.querySelector('#uploadHint');
const previewWrap = document.querySelector('#previewWrap');
const previewList = document.querySelector('#previewList');
const previewCount = document.querySelector('#previewCount');
const previewSize = document.querySelector('#previewSize');
const submitButton = document.querySelector('#submitButton');
const uploadMessage = document.querySelector('#uploadMessage');
const refreshMySubmission = document.querySelector('#refreshMySubmission');
const mySubmissionPanel = document.querySelector('#mySubmissionPanel');
const mySubmissionMeta = document.querySelector('#mySubmissionMeta');
const mySubmissionMessage = document.querySelector('#mySubmissionMessage');
const myImagesGrid = document.querySelector('#myImagesGrid');

const changePasswordForm = document.querySelector('#changePasswordForm');
const currentPassword = document.querySelector('#currentPassword');
const newPassword = document.querySelector('#newPassword');
const confirmPassword = document.querySelector('#confirmPassword');
const passwordMessage = document.querySelector('#passwordMessage');

const countTotal = document.querySelector('#countTotal');
const countCadre = document.querySelector('#countCadre');
const count1 = document.querySelector('#count1');
const count2 = document.querySelector('#count2');
const count3 = document.querySelector('#count3');

const cadreTaskSelect = document.querySelector('#cadreTaskSelect');
const newTaskTitle = document.querySelector('#newTaskTitle');
const createTaskForm = document.querySelector('#createTaskForm');
const cadreTaskMessage = document.querySelector('#cadreTaskMessage');
const refreshCadreButton = document.querySelector('#refreshCadreButton');
const toggleTaskButton = document.querySelector('#toggleTaskButton');
const deleteTaskButton = document.querySelector('#deleteTaskButton');
const exportZipButton = document.querySelector('#exportZipButton');
const cadreSearchInput = document.querySelector('#cadreSearchInput');
const cadreSections = document.querySelector('#cadreSections');
const cadreDashboardMessage = document.querySelector('#cadreDashboardMessage');
const cadreTotal = document.querySelector('#cadreTotal');
const cadreCountCadre = document.querySelector('#cadreCountCadre');
const cadreCount1 = document.querySelector('#cadreCount1');
const cadreCount2 = document.querySelector('#cadreCount2');
const cadreCount3 = document.querySelector('#cadreCount3');
const filterTabs = [...document.querySelectorAll('.filter-tab')];

const galleryDialog = document.querySelector('#galleryDialog');
const closeGalleryButton = document.querySelector('#closeGalleryButton');
const galleryTitle = document.querySelector('#galleryTitle');
const galleryMeta = document.querySelector('#galleryMeta');
const galleryMainImage = document.querySelector('#galleryMainImage');
const galleryThumbs = document.querySelector('#galleryThumbs');

let roster = [];
let currentMember = null;
let tasks = [];
let cadreTasks = [];
let currentFilterUnit = 'all';
let cadreSubmissions = [];
let previewUrls = [];
let galleryImages = [];
let galleryIndex = 0;
let galleryOwner = null;

function showMessage(node, text, type = '') {
  node.className = `form-message ${type}`.trim();
  node.textContent = text || '';
}

function formatBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setButtonLoading(button, loading, loadingText = 'Đang xử lý...') {
  if (!button) return;
  if (!button.dataset.defaultLabel) button.dataset.defaultLabel = button.textContent;
  button.disabled = loading;
  button.textContent = loading ? loadingText : button.dataset.defaultLabel;
}

function clearPreviewUrls() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
}

function validateFiles(files) {
  if (!files.length) {
    return 'Bạn chưa chọn tài liệu.';
  }

  if (files.length > MAX_FILES) {
    return `Mỗi lần chỉ chọn tối đa ${MAX_FILES} tài liệu.`;
  }

  let total = 0;

  for (const file of files) {
    const ext =
      getFileExtension(file.name);

    if (
      !ALLOWED_EXTENSIONS.includes(ext)
    ) {
      return (
        `File "${file.name}" ` +
        `không thuộc định dạng được hỗ trợ.`
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return (
        `File "${file.name}" ` +
        `vượt quá 20 MB.`
      );
    }

    total += file.size;
  }

  if (total > MAX_TOTAL_SIZE) {
    return (
      'Tổng dung lượng tài liệu ' +
      'vượt quá 100 MB.'
    );
  }

  return '';
}

async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    cache: 'no-store',
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Có lỗi xảy ra.');
  return data;
}

function getGroupMembers(unitCode) {
  return roster.find(group => group.code === unitCode)?.members || [];
}

function populateUnitSelect() {
  unitSelect.innerHTML = '<option value="">Chọn nhóm</option>';
  for (const group of roster) {
    const option = document.createElement('option');
    option.value = group.code;
    option.textContent = group.label;
    unitSelect.appendChild(option);
  }
}

function populateMemberSelect(unitCode) {
  const members = getGroupMembers(unitCode);
  memberSelect.replaceChildren();
  if (!unitCode) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chọn nhóm trước';
    memberSelect.appendChild(option);
    memberSelect.disabled = true;
    return;
  }
  memberSelect.disabled = false;
  const first = document.createElement('option');
  first.value = '';
  first.textContent = `Chọn thành viên ${roster.find(item => item.code === unitCode)?.label || ''}`;
  memberSelect.appendChild(first);
  for (const member of members) {
    const option = document.createElement('option');
    option.value = String(member.id);
    option.textContent = member.name;
    memberSelect.appendChild(option);
  }
}

function setSessionUI(member) {
  currentMember = member;
  const loggedIn = !!member;
  sessionPanel.classList.toggle('hidden', !loggedIn);
  logoutButton.classList.toggle('hidden', !loggedIn);
  memberDashboard.classList.toggle('hidden', !loggedIn);
  mySubmissionPanel.classList.toggle('hidden', !loggedIn);
  cadreDashboard.classList.toggle('hidden', !(loggedIn && member.role === 'cadre'));
  if (!loggedIn) {
    sessionGreeting.textContent = 'Xin chào';
    sessionMeta.textContent = 'Hãy đăng nhập để tiếp tục.';
    roleBadge.textContent = 'Khách';
    defaultPasswordBanner.classList.add('hidden');
    return;
  }

  sessionGreeting.textContent = `Xin chào ${member.name}`;
  sessionMeta.textContent = `${member.unit_label} · ${member.role === 'cadre' ? 'quyền cán bộ trung đội' : 'quyền học viên'}`;
  roleBadge.textContent = member.role === 'cadre' ? 'Cán bộ trung đội' : 'Học viên';
  roleBadge.style.background = member.role === 'cadre' ? 'rgba(46,197,182,.18)' : 'rgba(75,139,255,.12)';
  roleBadge.style.color = member.role === 'cadre' ? '#13897e' : '#4b8bff';
  defaultPasswordBanner.classList.toggle('hidden', !member.is_default_password);
}

function resetAllViews() {
  showMessage(loginMessage, '');
  showMessage(uploadMessage, '');
  showMessage(passwordMessage, '');
  showMessage(mySubmissionMessage, '');
  showMessage(cadreTaskMessage, '');
  showMessage(cadreDashboardMessage, '');
}

function imageUrl(image) {
  return `/api/image?id=${encodeURIComponent(image.id)}&v=${encodeURIComponent(image.created_at || '')}`;
}

async function loadRoster() {
  if (IS_LOCAL_FILE) {
    roster = [
      { code: 'cadre', label: 'Cán bộ trung đội', members: [{ id: 1, name: 'Vũ Trọng Thắng' }, { id: 2, name: 'Nguyễn Sở Trường' }] },
      { code: '1', label: 'Tiểu đội 1', members: [{ id: 3, name: 'Châu Đan Huy' }] },
      { code: '2', label: 'Tiểu đội 2', members: [{ id: 4, name: 'Thái Thanh Phong' }] },
      { code: '3', label: 'Tiểu đội 3', members: [{ id: 5, name: 'Trần Hoàng Kiên' }] }
    ];
  } else {
    const data = await fetchJSON('/api/roster');
    roster = data.groups || [];
  }
  populateUnitSelect();
}

async function loadSession() {
  if (IS_LOCAL_FILE) {
    setSessionUI(null);
    return;
  }
  const data = await fetchJSON('/api/auth/me').catch(() => ({ authenticated: false }));
  setSessionUI(data.member || null);
  if (data.member) {
    await afterLogin();
  }
}

async function loadTasks(forCadre = false) {
  if (!currentMember) return;
  const url = forCadre && currentMember.role === 'cadre' ? '/api/tasks?all=1' : '/api/tasks';
  const data = await fetchJSON(url);
  if (forCadre) {
    cadreTasks = data.tasks || [];
    renderCadreTaskSelect();
  } else {
    tasks = (data.tasks || []).filter(task => Number(task.is_active) === 1 || currentMember.role === 'cadre');
    taskSelect.replaceChildren();
    if (!tasks.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Hiện chưa có task nào đang mở';
      taskSelect.appendChild(option);
      submitButton.disabled = true;
      showMessage(uploadMessage, 'Cán bộ chưa mở task để nhận minh chứng.', 'error');
      return;
    }
    for (const task of tasks.filter(t => Number(t.is_active) === 1)) {
      const option = document.createElement('option');
      option.value = String(task.id);
      option.textContent = task.title;
      taskSelect.appendChild(option);
    }
    submitButton.disabled = false;
  }
}

function renderCadreTaskSelect() {
  cadreTaskSelect.replaceChildren();
  if (!cadreTasks.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Chưa có task';
    cadreTaskSelect.appendChild(option);
    return;
  }
  for (const task of cadreTasks) {
    const option = document.createElement('option');
    option.value = String(task.id);
    option.textContent = `${task.title}${Number(task.is_active) ? '' : ' · đã đóng'}`;
    cadreTaskSelect.appendChild(option);
  }
  updateCadreToggleButton();
}

async function loadStats(taskId = Number(taskSelect.value || cadreTaskSelect.value)) {
  if (!taskId) {
    for (const el of [countTotal, countCadre, count1, count2, count3, cadreTotal, cadreCountCadre, cadreCount1, cadreCount2, cadreCount3]) el.textContent = '0';
    return;
  }
  const data = await fetchJSON(`/api/stats?task_id=${encodeURIComponent(taskId)}`);
  countTotal.textContent = String(data.total ?? 0);
  countCadre.textContent = String(data.counts?.cadre ?? 0);
  count1.textContent = String(data.counts?.['1'] ?? 0);
  count2.textContent = String(data.counts?.['2'] ?? 0);
  count3.textContent = String(data.counts?.['3'] ?? 0);
  cadreTotal.textContent = String(data.total ?? 0);
  cadreCountCadre.textContent = String(data.counts?.cadre ?? 0);
  cadreCount1.textContent = String(data.counts?.['1'] ?? 0);
  cadreCount2.textContent = String(data.counts?.['2'] ?? 0);
  cadreCount3.textContent = String(data.counts?.['3'] ?? 0);
}
function clearPreviews() {
  clearPreviewUrls();

  previewList.replaceChildren();

  previewWrap.classList.add(
    'hidden'
  );

  uploadTitle.textContent =
    'Gửi tài liệu của bạn tại đây';

  uploadHint.textContent =
    'Ảnh · PDF · Word · Excel · PowerPoint · tối đa 20 MB/tệp';
}

function renderSelectedFiles() {
  const files =
    [...imagesInput.files];

  const error =
    validateFiles(files);

  clearPreviews();

  if (error) {
    if (files.length) {
      showMessage(
        uploadMessage,
        error,
        'error'
      );
    }

    return;
  }

  if (!files.length) {
    return;
  }

  showMessage(
    uploadMessage,
    ''
  );

  const total =
    files.reduce(
      (sum, file) =>
        sum + file.size,
      0
    );

  previewCount.textContent =
    `${files.length} tài liệu đã chọn`;

  previewSize.textContent =
    formatBytes(total);

  for (const file of files) {
    const card =
      document.createElement('div');

    card.className =
      'preview-item';

    if (isImageFile(file)) {
      const url =
        URL.createObjectURL(file);

      previewUrls.push(url);

      card.innerHTML = `
        <img
          src="${url}"
          alt="${file.name}"
        >

        <div class="preview-meta">
          <strong>${file.name}</strong>
          <small>
            ${formatBytes(file.size)}
          </small>
        </div>
      `;
    } else {
      card.innerHTML = `
        <div class="file-preview-placeholder">
          <span>
            ${getFileLabel(file)}
          </span>
        </div>

        <div class="preview-meta">
          <strong>${file.name}</strong>
          <small>
            ${formatBytes(file.size)}
          </small>
        </div>
      `;
    }

    previewList.appendChild(card);
  }

  uploadTitle.textContent =
    `${files.length} tài liệu đã sẵn sàng`;

  uploadHint.textContent =
    'Có thể chọn lại nếu muốn thay đổi danh sách tài liệu.';

  previewWrap.classList.remove(
    'hidden'
  );
}

async function loadMySubmission() {
  if (!currentMember) return;
  const taskId = Number(taskSelect.value);
  if (!taskId) {
    mySubmissionMeta.textContent = 'Chọn task để xem các tài liệu bạn đã nộp.';
    myImagesGrid.className = 'my-images-grid empty-state';
    myImagesGrid.innerHTML = '<div class="empty-box"><strong>Chưa chọn task.</strong><span>Hãy chọn task ở phần trên để xem hồ sơ cá nhân.</span></div>';
    return;
  }

  showMessage(mySubmissionMessage, 'Đang tải hồ sơ tài liệu của bạn...');
  const data = await fetchJSON(`/api/me/submission?task_id=${encodeURIComponent(taskId)}`);
  const task = tasks.find(item => Number(item.id) === taskId) || cadreTasks.find(item => Number(item.id) === taskId);
  mySubmissionMeta.textContent = task ? `Task: ${task.title}` : 'Hồ sơ hiện tại';

  if (!data.submission || !(data.images || []).length) {
    myImagesGrid.className = 'my-images-grid empty-state';
    myImagesGrid.innerHTML = '<div class="empty-box"><strong>Chưa có tài liệu minh chứng nào trong task này.</strong><span>Khi bạn tải tài liệu lên, chúng sẽ xuất hiện tại đây.</span></div>';
    showMessage(mySubmissionMessage, '');
    return;
  }

  myImagesGrid.className = 'my-images-grid';
  myImagesGrid.replaceChildren();
  for (const image of data.images) {
    const card = document.createElement('article');
    card.className = 'my-image-card';
    card.innerHTML = `
      <img loading="lazy" src="${imageUrl(image)}" alt="${image.image_name || 'tài liệu minh chứng'}">
      <div class="my-image-body">
        <strong>${image.image_name || 'tài liệu minh chứng'}</strong>
        <small>${formatBytes(image.image_size || 0)} · ${new Date(image.created_at).toLocaleString('vi-VN')}</small>
      </div>
      <div class="my-image-actions">
        <small>Mã tài liệu #${image.id}</small>
        <button class="delete-button" type="button" data-image-id="${image.id}">Xóa tài liệu này</button>
      </div>
    `;
    myImagesGrid.appendChild(card);
  }
  showMessage(mySubmissionMessage, `Bạn đang có ${data.images.length} tài liệu trong task này.`);
}

async function afterLogin() {
  resetAllViews();
  await loadTasks(false);
  await loadStats(Number(taskSelect.value));
  await loadMySubmission();
  if (currentMember?.role === 'cadre') {
    await loadTasks(true);
    await loadCadreDashboard();
  }
}

async function loadCadreDashboard() {
  if (currentMember?.role !== 'cadre') return;
  if (!cadreTasks.length) {
    cadreSections.innerHTML = '<div class="empty-box"><strong>Chưa có task nào.</strong><span>Hãy tạo task mới để bắt đầu thống kê.</span></div>';
    return;
  }
  if (!cadreTaskSelect.value) cadreTaskSelect.value = String(cadreTasks[0].id);
  updateCadreToggleButton();
  await loadStats(Number(cadreTaskSelect.value));
  await fetchCadreSubmissions();
}

function updateCadreToggleButton() {
  const task = cadreTasks.find(item => String(item.id) === String(cadreTaskSelect.value));
  if (!task) {
    toggleTaskButton.disabled = true;
    deleteTaskButton.disabled = true;
    exportZipButton.disabled = true;
    return;
  }
  toggleTaskButton.disabled = false;
  deleteTaskButton.disabled = false;
  exportZipButton.disabled = false;
  toggleTaskButton.textContent = Number(task.is_active) ? 'Đóng nhận bài' : 'Mở nhận bài';
}

async function fetchCadreSubmissions() {
  const taskId = Number(cadreTaskSelect.value);
  if (!taskId) return;
  showMessage(cadreDashboardMessage, 'Đang tải danh sách nộp bài...');
  const data = await fetchJSON(`/api/cadre/submissions?task_id=${encodeURIComponent(taskId)}`);
  cadreSubmissions = data.submissions || [];
  renderCadreSections();
  const task = cadreTasks.find(item => Number(item.id) === taskId);
  showMessage(cadreDashboardMessage, task ? `Task: ${task.title} · cập nhật lúc ${new Date().toLocaleTimeString('vi-VN')}` : '');
}

function renderCadreSections() {
  const sections = [
    { code: 'cadre', label: 'Cán bộ trung đội' },
    { code: '1', label: 'Tiểu đội 1' },
    { code: '2', label: 'Tiểu đội 2' },
    { code: '3', label: 'Tiểu đội 3' }
  ];
  const search = cadreSearchInput.value.trim().toLowerCase();
  cadreSections.replaceChildren();

  let shown = 0;
  for (const section of sections) {
    if (currentFilterUnit !== 'all' && currentFilterUnit !== section.code) continue;
    const items = cadreSubmissions.filter(item => item.unit_code === section.code && (!search || item.name.toLowerCase().includes(search)));
    const card = document.createElement('section');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-head">
        <h3>${section.label}</h3>
        <span>${items.length} người đã nộp</span>
      </div>
      <div class="section-grid"></div>
    `;
    const grid = card.querySelector('.section-grid');
    if (!items.length) {
      grid.innerHTML = '<div class="empty-box"><strong>Chưa có bản nộp nào ở nhóm này.</strong><span>Khi có người nộp, tên và số tài liệu sẽ hiện ở đây.</span></div>';
    } else {
      shown += items.length;
      for (const item of items) {
        const article = document.createElement('article');
        article.className = 'person-card';
        article.innerHTML = `
          <strong>${item.name}</strong>
          <div class="person-meta">
            <div>${item.image_count} tài liệu minh chứng</div>
            <div>Cập nhật: ${new Date(item.updated_at).toLocaleString('vi-VN')}</div>
          </div>
          <button class="soft-button" type="button">Xem tài liệu</button>
        `;
        article.querySelector('button').addEventListener('click', () => openGallery(item));
        grid.appendChild(article);
      }
    }
    cadreSections.appendChild(card);
  }

  if (!shown && cadreSubmissions.length) {
    showMessage(cadreDashboardMessage, 'Không tìm thấy kết quả khớp bộ lọc hiện tại.', 'error');
  }
}

async function openGallery(item) {
  galleryOwner = item;
  galleryTitle.textContent = item.name;
  galleryMeta.textContent = `${item.unit_label} · đang tải tài liệu...`;
  galleryThumbs.replaceChildren();
  galleryMainImage.removeAttribute('src');
  galleryDialog.showModal();
  const data = await fetchJSON(`/api/cadre/images?submission_id=${encodeURIComponent(item.id)}`);
  galleryImages = data.images || [];
  galleryIndex = 0;

  if (!galleryImages.length) {
    galleryMeta.textContent = `${item.unit_label} · chưa có tài liệu.`;
    return;
  }

  renderGallery();
}

function renderGallery() {
  const current = galleryImages[galleryIndex];
  if (!current) return;
  galleryMainImage.src = imageUrl(current);
  galleryMeta.textContent = `${galleryOwner.unit_label} · tài liệu ${galleryIndex + 1}/${galleryImages.length} · ${current.image_name || 'tài liệu minh chứng'}`;
  galleryThumbs.replaceChildren();
  galleryImages.forEach((img, index) => {
    const button = document.createElement('button');
    button.className = `thumb-chip ${index === galleryIndex ? 'active' : ''}`.trim();
    button.type = 'button';
    button.textContent = `${index + 1}`;
    button.addEventListener('click', () => {
      galleryIndex = index;
      renderGallery();
    });
    galleryThumbs.appendChild(button);
  });

  const next = galleryImages[galleryIndex + 1];
  if (next) {
    const preload = new Image();
    preload.src = imageUrl(next);
  }
}

unitSelect.addEventListener('change', () => {
  populateMemberSelect(unitSelect.value);
});

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    showMessage(loginMessage, 'Bản local chỉ để xem giao diện. Cần chạy trên Cloudflare để đăng nhập thật.', 'error');
    return;
  }

  const memberId = Number(memberSelect.value);
  const password = passwordInput.value;
  if (!unitSelect.value) return showMessage(loginMessage, 'Hãy chọn nhóm.', 'error');
  if (!memberId) return showMessage(loginMessage, 'Hãy chọn họ tên trong danh sách.', 'error');
  if (!password) return showMessage(loginMessage, 'Hãy nhập mật khẩu.', 'error');

  setButtonLoading(loginButton, true, 'Đang xác thực...');
  showMessage(loginMessage, 'Đang kiểm tra tài khoản...');
  try {
    const data = await fetchJSON('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, password })
    });
    setSessionUI(data.member);
    showMessage(loginMessage, 'Đăng nhập thành công.', 'success');
    passwordInput.value = '';
    await afterLogin();
  } catch (error) {
    showMessage(loginMessage, error.message || 'Đăng nhập thất bại.', 'error');
  } finally {
    setButtonLoading(loginButton, false);
  }
});

logoutButton.addEventListener('click', async () => {
  if (!IS_LOCAL_FILE) {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  }
  currentMember = null;
  setSessionUI(null);
  taskSelect.innerHTML = '<option value="">Đăng nhập để xem task</option>';
  cadreTaskSelect.innerHTML = '<option value="">Đăng nhập để xem task</option>';
  cadreSections.replaceChildren();
  myImagesGrid.innerHTML = '<div class="empty-box"><strong>Đã đăng xuất.</strong><span>Đăng nhập lại để xem hồ sơ của bạn.</span></div>';
  showMessage(loginMessage, 'Đã đăng xuất.', 'success');
});

chooseFilesButton.addEventListener('click', event => {
  event.preventDefault();
  imagesInput.click();
});
imagesInput.addEventListener('change', renderSelectedFiles);
['dragenter', 'dragover'].forEach(type => uploadBox.addEventListener(type, event => {
  event.preventDefault();
  uploadBox.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(type => uploadBox.addEventListener(type, event => {
  event.preventDefault();
  uploadBox.classList.remove('dragover');
}));
uploadBox.addEventListener('drop', event => {
  const files = [...(event.dataTransfer.files || [])].slice(0, MAX_FILES);
  if (!files.length) return;
  const dt = new DataTransfer();
  files.forEach(file => dt.items.add(file));
  imagesInput.files = dt.files;
  renderSelectedFiles();
});

taskSelect.addEventListener('change', async () => {
  await loadStats(Number(taskSelect.value));
  await loadMySubmission();
});
refreshMySubmission.addEventListener('click', loadMySubmission);

uploadForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    showMessage(uploadMessage, 'Bản local không thể gửi dữ liệu thật.', 'error');
    return;
  }
  const files = [...imagesInput.files];
  const error = validateFiles(files);
  if (!taskSelect.value) return showMessage(uploadMessage, 'Hãy chọn task cần minh chứng.', 'error');
  if (error) return showMessage(uploadMessage, error, 'error');

  const body = new FormData();
  body.append('task_id', taskSelect.value);
  files.forEach(file => body.append('images', file));
  setButtonLoading(submitButton, true, 'Đang gửi...');
  showMessage(uploadMessage, `Đang tải ${files.length} tài liệu lên hệ thống...`);
  try {
    const data = await fetchJSON('/api/me/upload', { method: 'POST', body });
    showMessage(uploadMessage, data.message || 'Đã gửi minh chứng.', 'success');
    imagesInput.value = '';
    clearPreviews();
    await loadStats(Number(taskSelect.value));
    await loadMySubmission();
    if (currentMember?.role === 'cadre') await fetchCadreSubmissions();
  } catch (error) {
    showMessage(uploadMessage, error.message || 'Không thể gửi minh chứng.', 'error');
  } finally {
    setButtonLoading(submitButton, false);
  }
});

myImagesGrid.addEventListener('click', async event => {
  const button = event.target.closest('[data-image-id]');
  if (!button) return;
  const imageId = Number(button.dataset.imageId);
  if (!imageId) return;
  if (!confirm('Bạn muốn xóa tài liệu này khỏi hồ sơ của mình?')) return;
  button.disabled = true;
  try {
    const data = await fetchJSON(`/api/me/images?id=${encodeURIComponent(imageId)}`, { method: 'DELETE' });
    showMessage(mySubmissionMessage, data.remaining === 0 ? 'Đã xóa tài liệu cuối cùng trong task này.' : 'Đã xóa tài liệu thành công.', 'success');
    await loadStats(Number(taskSelect.value));
    await loadMySubmission();
    if (currentMember?.role === 'cadre') await fetchCadreSubmissions();
  } catch (error) {
    showMessage(mySubmissionMessage, error.message || 'Không thể xóa tài liệu.', 'error');
    button.disabled = false;
  }
});

changePasswordForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) return showMessage(passwordMessage, 'Bản local không hỗ trợ đổi mật khẩu.', 'error');
  setButtonLoading(changePasswordForm.querySelector('button[type="submit"]'), true, 'Đang đổi...');
  try {
    const data = await fetchJSON('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword.value,
        new_password: newPassword.value,
        confirm_password: confirmPassword.value
      })
    });
    showMessage(passwordMessage, data.message || 'Đổi mật khẩu thành công.', 'success');
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    if (currentMember) {
      currentMember.is_default_password = false;
      defaultPasswordBanner.classList.add('hidden');
    }
  } catch (error) {
    showMessage(passwordMessage, error.message || 'Không thể đổi mật khẩu.', 'error');
  } finally {
    setButtonLoading(changePasswordForm.querySelector('button[type="submit"]'), false);
  }
});

createTaskForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!newTaskTitle.value.trim()) return showMessage(cadreTaskMessage, 'Hãy nhập tên task mới.', 'error');
  const button = createTaskForm.querySelector('button');
  setButtonLoading(button, true, 'Đang tạo...');
  try {
    const data = await fetchJSON('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTaskTitle.value })
    });
    showMessage(cadreTaskMessage, `Đã tạo task: ${data.task.title}`, 'success');
    newTaskTitle.value = '';
    await loadTasks(false);
    await loadTasks(true);
    cadreTaskSelect.value = String(data.task.id);
    taskSelect.value = String(data.task.id);
    await loadCadreDashboard();
    await loadMySubmission();
  } catch (error) {
    showMessage(cadreTaskMessage, error.message || 'Không thể tạo task.', 'error');
  } finally {
    setButtonLoading(button, false);
  }
});

cadreTaskSelect.addEventListener('change', async () => {
  updateCadreToggleButton();
  await loadCadreDashboard();
});
refreshCadreButton.addEventListener('click', loadCadreDashboard);

toggleTaskButton.addEventListener('click', async () => {
  const task = cadreTasks.find(item => String(item.id) === String(cadreTaskSelect.value));
  if (!task) return;
  const next = Number(task.is_active) ? 0 : 1;
  setButtonLoading(toggleTaskButton, true, next ? 'Đang mở...' : 'Đang đóng...');
  try {
    const data = await fetchJSON('/api/cadre/toggle-task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: task.id, is_active: next })
    });
    showMessage(cadreTaskMessage, `${next ? 'Đã mở' : 'Đã đóng'} task: ${data.task.title}`, 'success');
    await loadTasks(false);
    await loadTasks(true);
    cadreTaskSelect.value = String(task.id);
    await loadCadreDashboard();
  } catch (error) {
    showMessage(cadreTaskMessage, error.message || 'Không thể đổi trạng thái task.', 'error');
  } finally {
    setButtonLoading(toggleTaskButton, false);
  }
});

deleteTaskButton.addEventListener('click', async () => {
  const task = cadreTasks.find(
    item => String(item.id) === String(cadreTaskSelect.value)
  );

  if (!task) return;

  const firstConfirm = confirm(
    `Xóa task "${task.title}"?\n\n` +
    `Toàn bộ tài liệu minh chứng của tất cả thành viên trong task này ` +
    `sẽ bị xóa vĩnh viễn khỏi R2.`
  );

  if (!firstConfirm) return;

  const secondConfirm = confirm(
    `XÁC NHẬN LẦN CUỐI\n\n` +
    `Task: ${task.title}\n\n` +
    `Sau thao tác này không thể khôi phục. Tiếp tục?`
  );

  if (!secondConfirm) return;

  setButtonLoading(
    deleteTaskButton,
    true,
    'Đang xóa...'
  );

  showMessage(
    cadreTaskMessage,
    'Đang xóa task và toàn bộ tài liệu minh chứng...'
  );

  try {
    const data = await fetchJSON(
      `/api/cadre/delete-task?task_id=${encodeURIComponent(task.id)}`,
      {
        method: 'DELETE'
      }
    );

    showMessage(
      cadreTaskMessage,
      `Đã xóa "${data.deleted_task}" và ${data.deleted_images} tài liệu.`,
      'success'
    );

    // Tải lại danh sách task ở cả khu cá nhân và khu quản lý.
    await loadTasks(false);
    await loadTasks(true);

    if (cadreTasks.length) {
      cadreTaskSelect.value = String(cadreTasks[0].id);

      const firstActive = tasks.find(
        item => Number(item.is_active) === 1
      );

      if (firstActive) {
        taskSelect.value = String(firstActive.id);
      }

      await loadCadreDashboard();
      await loadMySubmission();

    } else {
      cadreSections.innerHTML = `
        <div class="empty-box">
          <strong>Chưa có task nào.</strong>
          <span>Hãy tạo task mới để bắt đầu.</span>
        </div>
      `;

      await loadStats(0);
      updateCadreToggleButton();
      await loadMySubmission();
    }

  } catch (error) {
    showMessage(
      cadreTaskMessage,
      error.message || 'Không thể xóa task.',
      'error'
    );

  } finally {
    setButtonLoading(
      deleteTaskButton,
      false
    );
  }
});

exportZipButton.addEventListener('click', () => {
  const taskId = Number(cadreTaskSelect.value);
  if (!taskId) return;
  window.location.href = `/api/cadre/export?task_id=${encodeURIComponent(taskId)}`;
});

cadreSearchInput.addEventListener('input', renderCadreSections);
filterTabs.forEach(tab => tab.addEventListener('click', () => {
  filterTabs.forEach(item => item.classList.remove('active'));
  tab.classList.add('active');
  currentFilterUnit = tab.dataset.unit;
  renderCadreSections();
}));

closeGalleryButton.addEventListener('click', () => galleryDialog.close());
galleryDialog.addEventListener('click', event => {
  const rect = galleryDialog.getBoundingClientRect();
  const inside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
  if (!inside) galleryDialog.close();
});

document.addEventListener('keydown', event => {
  if (!galleryDialog.open) return;
  if (event.key === 'ArrowRight' && galleryIndex < galleryImages.length - 1) {
    galleryIndex += 1; renderGallery();
  }
  if (event.key === 'ArrowLeft' && galleryIndex > 0) {
    galleryIndex -= 1; renderGallery();
  }
});

(async function init() {
  await loadRoster();
  await loadSession();
})();
