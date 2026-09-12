const form = document.querySelector('#submissionForm');
const taskInput = document.querySelector('#task');
const squadInput = document.querySelector('#squad');
const nameInput = document.querySelector('#name');
const imageInput = document.querySelector('#images');
const uploadBox = document.querySelector('#uploadBox');
const chooseFileButton = document.querySelector('#chooseFileButton');
const uploadTitle = document.querySelector('#uploadTitle');
const uploadHint = document.querySelector('#uploadHint');
const previewWrap = document.querySelector('#previewWrap');
const previewList = document.querySelector('#previewList');
const previewCount = document.querySelector('#previewCount');
const previewTotalSize = document.querySelector('#previewTotalSize');
const submitButton = document.querySelector('#submitButton');
const formMessage = document.querySelector('#formMessage');
const refreshStatsButton = document.querySelector('#refreshStats');
const statsTaskTitle = document.querySelector('#statsTaskTitle');

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const MAX_FILES = 10;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const IS_LOCAL_FILE = window.location.protocol === 'file:';
let previewUrls = [];
let tasks = [];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function showMessage(text, type = '') {
  formMessage.className = `form-message ${type}`.trim();
  formMessage.textContent = text;
}

function setLoading(loading) {
  submitButton.disabled = loading || !taskInput.value;
  submitButton.classList.toggle('loading', loading);
}

function clearPreviews() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  previewList.replaceChildren();
  previewWrap.classList.add('hidden');
}

function validateFiles(files) {
  if (!files.length) return 'Bạn chưa chọn ảnh minh chứng.';
  if (files.length > MAX_FILES) return `Mỗi lần chỉ chọn tối đa ${MAX_FILES} ảnh.`;
  let total = 0;
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) return `File "${file.name}" không phải PNG, JPG/JPEG hoặc WEBP.`;
    if (file.size > MAX_FILE_SIZE) return `Ảnh "${file.name}" vượt quá 8 MB.`;
    total += file.size;
  }
  if (total > MAX_TOTAL_SIZE) return 'Tổng dung lượng ảnh vượt quá 50 MB.';
  return '';
}

function renderFiles() {
  const files = [...imageInput.files];
  const error = validateFiles(files);
  clearPreviews();

  if (error) {
    showMessage(error, 'error');
    imageInput.value = '';
    return;
  }

  showMessage('');
  const total = files.reduce((sum, file) => sum + file.size, 0);
  previewCount.textContent = `${files.length} ảnh đã chọn`;
  previewTotalSize.textContent = formatBytes(total);

  for (const file of files) {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const item = document.createElement('div');
    item.className = 'preview-item';
    const img = document.createElement('img');
    img.src = url;
    img.alt = file.name;
    const meta = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = file.name;
    const small = document.createElement('small');
    small.textContent = formatBytes(file.size);
    meta.append(strong, small);
    item.append(img, meta);
    previewList.appendChild(item);
  }

  uploadTitle.textContent = `${files.length} ảnh đã sẵn sàng`;
  uploadHint.textContent = 'Có thể chọn lại để thay danh sách ảnh trước khi gửi';
  previewWrap.classList.remove('hidden');
}

chooseFileButton.addEventListener('click', event => {
  event.preventDefault();
  imageInput.click();
});

imageInput.addEventListener('change', renderFiles);

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
  imageInput.files = dt.files;
  renderFiles();
});

function resetStats() {
  document.querySelector('#totalCount').textContent = '0';
  for (const squad of [1, 2, 3]) document.querySelector(`#squad${squad}Count`).textContent = '0';
}

async function loadTasks() {
  if (IS_LOCAL_FILE) {
    tasks = [{ id: 1, title: 'Task mẫu khi xem local' }];
    taskInput.innerHTML = '<option value="1">Task mẫu khi xem local</option>';
    statsTaskTitle.textContent = 'Task mẫu khi xem local';
    resetStats();
    submitButton.disabled = false;
    return;
  }

  try {
    const response = await fetch('/api/tasks', { cache: 'no-store' });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không tải được task.');
    tasks = data.tasks || [];
    taskInput.replaceChildren();

    if (!tasks.length) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'Hiện chưa có task nào đang mở';
      taskInput.appendChild(option);
      taskInput.disabled = true;
      submitButton.disabled = true;
      statsTaskTitle.textContent = 'Chưa có task đang mở';
      resetStats();
      showMessage('Cán bộ chưa mở task để nhận minh chứng.', 'error');
      return;
    }

    taskInput.disabled = false;
    for (const task of tasks) {
      const option = document.createElement('option');
      option.value = String(task.id);
      option.textContent = task.title;
      taskInput.appendChild(option);
    }
    submitButton.disabled = false;
    await loadStats();
  } catch (error) {
    taskInput.innerHTML = '<option value="">Không tải được task</option>';
    taskInput.disabled = true;
    submitButton.disabled = true;
    showMessage(error.message || 'Không tải được danh sách task.', 'error');
  }
}

async function loadStats() {
  const taskId = Number(taskInput.value);
  const task = tasks.find(item => Number(item.id) === taskId);
  statsTaskTitle.textContent = task?.title || 'Đã nộp hiện tại';

  if (!taskId || IS_LOCAL_FILE) {
    resetStats();
    return;
  }

  try {
    const response = await fetch(`/api/stats?task_id=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Không tải được thống kê');
    const data = await response.json();
    document.querySelector('#totalCount').textContent = data.total ?? 0;
    for (const squad of [1, 2, 3]) {
      document.querySelector(`#squad${squad}Count`).textContent = data.squads?.[String(squad)] ?? 0;
    }
  } catch {
    document.querySelector('#totalCount').textContent = '—';
  }
}

refreshStatsButton.addEventListener('click', loadStats);
taskInput.addEventListener('change', loadStats);

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    showMessage('Bản local chỉ xem giao diện. Gửi dữ liệu thật cần chạy trên Cloudflare Pages.', 'error');
    return;
  }

  const taskId = taskInput.value;
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  const squad = squadInput.value;
  const files = [...imageInput.files];

  if (!taskId) return showMessage('Hãy chọn task cần nộp.', 'error');
  if (!squad) return showMessage('Hãy chọn tiểu đội của bạn.', 'error');
  if (name.length < 2) return showMessage('Hãy nhập họ và tên đầy đủ.', 'error');
  const fileError = validateFiles(files);
  if (fileError) return showMessage(fileError, 'error');

  const body = new FormData();
  body.append('task_id', taskId);
  body.append('squad', squad);
  body.append('name', name);
  files.forEach(file => body.append('images', file));

  setLoading(true);
  showMessage(`Đang tải ${files.length} ảnh và lưu kết quả...`);

  try {
    const response = await fetch('/api/submit', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể gửi minh chứng.');

    showMessage(`Đã thêm ${data.added} ảnh. Hiện bạn có ${data.image_count} ảnh trong task này.`, 'success');
    imageInput.value = '';
    clearPreviews();
    uploadTitle.textContent = 'Chọn một hoặc nhiều ảnh minh chứng';
    uploadHint.textContent = 'PNG, JPG hoặc WEBP · tối đa 8 MB/ảnh · tối đa 10 ảnh/lần';
    await loadStats();
  } catch (error) {
    showMessage(error.message || 'Có lỗi xảy ra. Hãy thử lại.', 'error');
  } finally {
    setLoading(false);
  }
});

loadTasks();
if (!IS_LOCAL_FILE) setInterval(loadStats, 20000);
