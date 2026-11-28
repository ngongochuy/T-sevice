const byId = id => document.getElementById(id);
const notice = byId('admin-status');
const loginForm = byId('admin-login');
const requestList = byId('requests-list');
const documentList = byId('documents-list');
const imageForm = byId('image-upload');
const documentForm = byId('document-upload');
const statusLabels = { new: 'Mới', working: 'Đang xử lý', done: 'Đã xử lý' };
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const documentTypes = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
};
const batchSize = 50;
let client;
let lastRequestId;
let documentOffset = 0;

function setNotice(message, error = false) {
  notice.textContent = message;
  notice.classList.toggle('error', error);
}

function element(tag, content) {
  const node = document.createElement(tag);
  node.textContent = content;
  return node;
}

async function withButton(button, action, errorMessage) {
  button.disabled = true;
  try {
    await action();
  } catch {
    setNotice(errorMessage, true);
  } finally {
    button.disabled = false;
  }
}

function showLogin() {
  byId('admin-panel').hidden = true;
  byId('login-panel').hidden = false;
  requestList.replaceChildren();
  documentList.replaceChildren();
  lastRequestId = undefined;
  documentOffset = 0;
  byId('requests-more').hidden = true;
  byId('documents-more').hidden = true;
  imageForm.reset();
  documentForm.reset();
}

function renderRequest(item) {
  const card = document.createElement('article');
  const date = new Date(item.created_at).toLocaleString('vi-VN');
  const phone = element('a', item.phone);
  phone.href = 'tel:' + item.phone;
  const description = element('p', item.description);
  description.className = 'request-notes';
  const status = document.createElement('select');
  for (const [value, label] of Object.entries(statusLabels)) status.add(new Option(label, value));
  status.value = item.status;
  const statusLabel = element('label', 'Trạng thái ');
  statusLabel.append(status);
  const save = element('button', 'Lưu trạng thái');
  save.type = 'button';
  save.addEventListener('click', () => withButton(save, async () => {
    const { error } = await client.from('td_support_requests')
      .update({ status: status.value }).eq('id', item.id).select('id').single();
    if (error) throw error;
    setNotice('Đã lưu trạng thái yêu cầu #' + item.id + '.');
  }, 'Chưa lưu được trạng thái. Vui lòng thử lại.'));
  card.append(element('small', '#' + item.id + ' · ' + date),
    element('h3', item.customer + ' · ' + item.equipment), phone, description, statusLabel, save);
  return card;
}

async function loadRequests() {
  let query = client.from('td_support_requests')
    .select('id,created_at,customer,phone,equipment,description,status')
    .order('id', { ascending: false }).limit(batchSize + 1);
  if (lastRequestId !== undefined) query = query.lt('id', lastRequestId);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data.slice(0, batchSize);
  if (!rows.length && lastRequestId === undefined) {
    requestList.append(element('p', 'Chưa có yêu cầu.'));
  }
  rows.forEach(row => requestList.append(renderRequest(row)));
  if (rows.length) lastRequestId = rows.at(-1).id;
  byId('requests-more').hidden = data.length <= batchSize;
}

function imageUrl(product) {
  return supabaseUrl + '/storage/v1/object/public/td-product-images/' +
    encodeURIComponent(product) + '?v=' + Date.now();
}

function refreshImage() {
  const preview = byId('product-preview');
  preview.hidden = true;
  preview.onload = () => { preview.hidden = false; };
  preview.onerror = () => { preview.hidden = true; };
  preview.src = imageUrl(imageForm.elements.product.value);
}

function documentName(key) {
  const match = /^[a-f0-9-]+--([a-f0-9]+)\.[a-z]+$/.exec(key);
  if (!match || match[1].length % 2 !== 0) return key;
  const bytes = Uint8Array.from(match[1].match(/../g), chunk => parseInt(chunk, 16));
  return new TextDecoder().decode(bytes);
}

function renderDocument(file) {
  const row = document.createElement('li');
  row.className = 'document-row';
  const name = documentName(file.name);
  const download = element('button', 'Tải xuống');
  download.type = 'button';
  download.addEventListener('click', () => withButton(download, async () => {
    const { data, error } = await client.storage.from('td-documents').download(file.name);
    if (error) throw error;
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'Chưa tải được tài liệu. Vui lòng thử lại.'));
  row.append(element('span', name), download);
  return row;
}

async function loadDocuments(reset = false) {
  const offset = reset ? 0 : documentOffset;
  const { data, error } = await client.storage.from('td-documents').list('', {
    limit: batchSize + 1, offset, sortBy: { column: 'name', order: 'asc' }
  });
  if (error) throw error;
  if (reset) documentList.replaceChildren();
  data.slice(0, batchSize).forEach(file => documentList.append(renderDocument(file)));
  if (!data.length && offset === 0) documentList.append(element('li', 'Chưa có tài liệu.'));
  documentOffset = offset + Math.min(batchSize, data.length);
  byId('documents-more').hidden = data.length <= batchSize;
}

async function showAdmin(session) {
  if (!session) {
    showLogin();
    setNotice('');
    return;
  }
  const { data, error } = await client.rpc('td_is_admin');
  if (error) throw error;
  if (data !== true) {
    await client.auth.signOut({ scope: 'local' });
    showLogin();
    setNotice('Tài khoản này chưa được cấp quyền quản trị.', true);
    return;
  }
  byId('login-panel').hidden = true;
  byId('admin-panel').hidden = false;
  setNotice('');
  refreshImage();
  const [requests, documents] = await Promise.allSettled([loadRequests(), loadDocuments(true)]);
  const unavailable = [];
  if (requests.status === 'rejected') unavailable.push('yêu cầu hỗ trợ và báo giá');
  if (documents.status === 'rejected') unavailable.push('tài liệu nội bộ');
  if (unavailable.length) {
    setNotice('Chưa tải được ' + unavailable.join(', ') + ' từ Supabase. Vui lòng tải lại trang.', true);
  }
}

async function startAdmin() {
  if (!useSupabase) {
    setNotice('Trang quản trị Supabase chưa được kết nối.');
    return;
  }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2/+esm');
  client = createClient(supabaseUrl, supabaseConfig.publishableKey, {
    auth: { detectSessionInUrl: false }
  });
  client.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') showLogin();
  });

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const fields = new FormData(loginForm);
    withButton(event.submitter, async () => {
      const { data, error } = await client.auth.signInWithPassword({
        email: fields.get('email').trim(), password: fields.get('password')
      });
      if (error) {
        setNotice('Đăng nhập thất bại. Kiểm tra email, mật khẩu hoặc thử lại sau.', true);
        return;
      }
      loginForm.reset();
      await showAdmin(data.session);
    }, 'Chưa tải được trang quản trị. Vui lòng thử lại.');
  });

  byId('admin-logout').addEventListener('click', event => withButton(event.currentTarget, async () => {
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    setNotice('Đã đăng xuất.');
  }, 'Chưa đăng xuất được. Vui lòng thử lại.'));

  byId('requests-more').addEventListener('click', event =>
    withButton(event.currentTarget, loadRequests, 'Chưa tải được yêu cầu.'));
  byId('documents-more').addEventListener('click', event =>
    withButton(event.currentTarget, () => loadDocuments(), 'Chưa tải được danh sách tài liệu.'));
  imageForm.elements.product.addEventListener('change', refreshImage);

  imageForm.addEventListener('submit', event => {
    event.preventDefault();
    const file = imageForm.elements.file.files[0];
    const product = imageForm.elements.product.value;
    if (!file || !imageTypes.has(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice('Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB.', true);
      return;
    }
    withButton(event.submitter, async () => {
      const { error } = await client.storage.from('td-product-images').upload(product, file, {
        upsert: true, contentType: file.type, cacheControl: '60'
      });
      if (error) throw error;
      imageForm.elements.file.value = '';
      refreshImage();
      setNotice('Đã lưu ảnh sản phẩm.');
    }, 'Chưa lưu được ảnh. Vui lòng thử lại.');
  });

  documentForm.addEventListener('submit', event => {
    event.preventDefault();
    const file = documentForm.elements.file.files[0];
    const extension = file?.name.split('.').at(-1).toLowerCase();
    if (!file || !Object.hasOwn(documentTypes, extension) ||
        file.name.length > 180 || file.size > 20 * 1024 * 1024) {
      setNotice('Chọn tệp PDF, DOCX, XLSX hoặc PPTX tối đa 20 MB và có tên tối đa 180 ký tự.', true);
      return;
    }
    const name = Array.from(new TextEncoder().encode(file.name), byte => byte.toString(16).padStart(2, '0')).join('');
    const key = crypto.randomUUID() + '--' + name + '.' + extension;
    withButton(event.submitter, async () => {
      const { error } = await client.storage.from('td-documents').upload(key, file, {
        contentType: documentTypes[extension]
      });
      if (error) throw error;
      documentForm.reset();
      setNotice('Đã thêm tài liệu.');
      try {
        await loadDocuments(true);
      } catch {
        setNotice('Đã lưu tài liệu. Tải lại trang để xem danh sách mới.', true);
      }
    }, 'Chưa thêm được tài liệu. Vui lòng thử lại.');
  });

  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  await showAdmin(data.session);
}

startAdmin().catch(() => setNotice('Chưa kết nối được trang quản trị Supabase. Vui lòng tải lại trang.', true));
