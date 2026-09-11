const form = document.querySelector('#submissionForm');
const squadInput = document.querySelector('#squad');
const nameInput = document.querySelector('#name');
const imageInput = document.querySelector('#image');
const uploadBox = document.querySelector('#uploadBox');
const chooseFileButton = document.querySelector('#chooseFileButton');
const uploadTitle = document.querySelector('#uploadTitle');
const uploadHint = document.querySelector('#uploadHint');
const previewWrap = document.querySelector('#previewWrap');
const previewImage = document.querySelector('#previewImage');
const previewName = document.querySelector('#previewName');
const previewSize = document.querySelector('#previewSize');
const submitButton = document.querySelector('#submitButton');
const formMessage = document.querySelector('#formMessage');
const refreshStatsButton = document.querySelector('#refreshStats');

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
let previewUrl = null;
const IS_LOCAL_FILE = window.location.protocol === 'file:';


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
  submitButton.disabled = loading;
  submitButton.classList.toggle('loading', loading);
}

function validateFile(file) {
  if (!file) return 'Bạn chưa chọn ảnh minh chứng.';
  if (!ALLOWED_TYPES.includes(file.type)) return 'Chỉ nhận ảnh PNG, JPG/JPEG hoặc WEBP.';
  if (file.size > MAX_FILE_SIZE) return 'Ảnh vượt quá 8 MB. Hãy chọn ảnh nhẹ hơn.';
  return '';
}

function renderFile(file) {
  const error = validateFile(file);
  if (error) {
    showMessage(error, 'error');
    imageInput.value = '';
    previewWrap.classList.add('hidden');
    return;
  }

  showMessage('');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  previewImage.src = previewUrl;
  previewName.textContent = file.name;
  previewSize.textContent = formatBytes(file.size);
  uploadTitle.textContent = 'Ảnh đã sẵn sàng';
  uploadHint.textContent = 'Bạn có thể chọn lại ảnh khác nếu cần';
  previewWrap.classList.remove('hidden');
}

chooseFileButton.addEventListener('click', (event) => {
  event.preventDefault();
  imageInput.click();
});

imageInput.addEventListener('change', () => renderFile(imageInput.files[0]));

['dragenter', 'dragover'].forEach(type => uploadBox.addEventListener(type, event => {
  event.preventDefault();
  uploadBox.classList.add('dragover');
}));
['dragleave', 'drop'].forEach(type => uploadBox.addEventListener(type, event => {
  event.preventDefault();
  uploadBox.classList.remove('dragover');
}));
uploadBox.addEventListener('drop', event => {
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  const dt = new DataTransfer();
  dt.items.add(file);
  imageInput.files = dt.files;
  renderFile(file);
});

async function loadStats() {
  if (IS_LOCAL_FILE) {
    document.querySelector('#totalCount').textContent = '0';
    for (const squad of [1, 2, 3]) {
      document.querySelector(`#squad${squad}Count`).textContent = '0';
    }
    return;
  }
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' });
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

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (IS_LOCAL_FILE) {
    showMessage('Bạn đang mở file trực tiếp trên máy. Giao diện hoạt động bình thường, nhưng gửi dữ liệu cần chạy trên Cloudflare Pages.', 'error');
    return;
  }
  const name = nameInput.value.trim().replace(/\s+/g, ' ');
  const squad = squadInput.value;
  const file = imageInput.files[0];

  if (!squad) return showMessage('Hãy chọn tiểu đội của bạn.', 'error');
  if (name.length < 2) return showMessage('Hãy nhập họ và tên đầy đủ.', 'error');
  const fileError = validateFile(file);
  if (fileError) return showMessage(fileError, 'error');

  const body = new FormData();
  body.append('squad', squad);
  body.append('name', name);
  body.append('image', file);

  setLoading(true);
  showMessage('Đang tải ảnh và lưu kết quả...');

  try {
    const response = await fetch('/api/submit', { method: 'POST', body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Không thể gửi minh chứng.');

    showMessage(data.replaced ? 'Đã cập nhật ảnh mới cho bạn. Không phát sinh bản ghi trùng.' : 'Nộp minh chứng thành công!', 'success');
    form.reset();
    previewWrap.classList.add('hidden');
    uploadTitle.textContent = 'Chọn ảnh minh chứng';
    uploadHint.textContent = 'PNG, JPG hoặc WEBP · tối đa 8 MB';
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
    await loadStats();
  } catch (error) {
    showMessage(error.message || 'Có lỗi xảy ra. Hãy thử lại.', 'error');
  } finally {
    setLoading(false);
  }
});

loadStats();
if (!IS_LOCAL_FILE) setInterval(loadStats, 20000);
