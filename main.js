// Khi đổi số, cập nhật cả các liên kết dự phòng trong index.html.
// Chấp nhận 09xxxxxxxx, +849xxxxxxxx hoặc 849xxxxxxxx.
const contact = {
  phone: '0981491091',
  zalo: '' // Bỏ trống để dùng cùng số hotline.
};

function normalizePhone(value) {
  const digits = value.replace(/\D/g, '');
  if (/^0[35789]\d{8}$/.test(digits)) return '84' + digits.slice(1);
  if (/^84[35789]\d{8}$/.test(digits)) return digits;
  if (/^0[2]\d{9}$/.test(digits)) return '84' + digits.slice(1);
  if (/^842\d{9}$/.test(digits)) return digits;
  return '';
}

const phone = normalizePhone(contact.phone);
const zalo = normalizePhone(contact.zalo || contact.phone);
const displayPhone = value => '0' + value.slice(2);
document.getElementById('year').textContent = new Date().getFullYear();

document.querySelectorAll('[data-contact]').forEach(link => {
  const isZalo = link.dataset.contact === 'zalo';
  const number = isZalo ? zalo : phone;
  if (number) {
    link.href = isZalo ? 'https://zalo.me/' + number : 'tel:+' + number;
    if (isZalo) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    const label = link.dataset.contactLabel || (isZalo ? 'Nhắn Zalo' : 'Gọi điện');
    link.setAttribute('aria-label', label + ' ' + displayPhone(number));
  } else {
    link.href = '#contact';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-disabled', 'true');
    link.title = 'Số liên hệ đang được cập nhật';
    link.addEventListener('click', event => {
      event.preventDefault();
      document.getElementById('contact').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
      const notice = document.getElementById('contact-placeholder');
      notice.hidden = false;
      notice.textContent = isZalo ? 'Số Zalo đang được cập nhật. Vui lòng quay lại sau.' : 'Số hotline đang được cập nhật. Vui lòng quay lại sau.';
      notice.setAttribute('role', 'status');
    });
  }
});
if (phone) document.querySelectorAll('[data-phone-label]').forEach(label => label.textContent = displayPhone(phone));
const notice = document.getElementById('contact-placeholder');
notice.hidden = Boolean(phone && zalo);
if (!notice.hidden) notice.textContent = !phone && !zalo ? 'Số liên hệ đang được cập nhật.' : !phone ? 'Số hotline đang được cập nhật.' : 'Số Zalo đang được cập nhật.';

const toggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('main-nav');
toggle.addEventListener('click', () => {
  const open = toggle.getAttribute('aria-expanded') !== 'true';
  toggle.setAttribute('aria-expanded', String(open));
  nav.classList.toggle('open', open);
});
function closeMenu() { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); }
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('open')) { closeMenu(); toggle.focus(); } });

const docSearch = document.getElementById('docSearch');
const docFilters = [...document.querySelectorAll('#docFilters .filter')];
const docCards = [...document.querySelectorAll('#docGrid .doc-card')];

function searchText(value) {
  return value.toLocaleLowerCase('vi').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd');
}

function filterDocs() {
  const query = searchText(docSearch.value.trim());
  const category = docFilters.find(filter => filter.classList.contains('active')).dataset.filter;
  docCards.forEach(card => {
    card.hidden = (category !== 'all' && card.dataset.cat !== category) ||
      !searchText(card.textContent).includes(query);
  });
  document.getElementById('noDocs').hidden = docCards.some(card => !card.hidden);
}

docSearch.addEventListener('input', filterDocs);
document.getElementById('docSearchButton').addEventListener('click', filterDocs);
docFilters.forEach(filter => {
  filter.setAttribute('aria-pressed', String(filter.classList.contains('active')));
  filter.addEventListener('click', () => {
    docFilters.forEach(item => {
      item.classList.toggle('active', item === filter);
      item.setAttribute('aria-pressed', String(item === filter));
    });
    filterDocs();
  });
});

const supportForm = document.getElementById('support-form');
const supportFormNote = document.getElementById('support-form-note');
const supportSubmit = supportForm.querySelector('button[type="submit"]');
if (useSupabase) {
  document.querySelectorAll('[data-product-image]').forEach(image => {
    const uploaded = new Image();
    uploaded.addEventListener('load', () => { image.src = uploaded.src; }, { once: true });
    uploaded.src = supabaseUrl + '/storage/v1/object/public/td-product-images/' +
      encodeURIComponent(image.dataset.productImage) + '?v=' + Math.floor(Date.now() / 60000);
  });
}
const supportDescription = supportForm.elements.namedItem('description');
const supportEquipment = supportForm.elements.namedItem('equipment');
const quoteContinue = document.getElementById('quote-continue');
const quoteCancel = document.getElementById('quote-cancel');
const quoteStatus = document.getElementById('quote-status');
const quoteCatalogStatus = document.getElementById('quote-catalog-status');
const quoteDraft = document.getElementById('quote-draft');
const cartButtons = document.querySelectorAll('[data-open-cart]');
const cartCounts = document.querySelectorAll('[data-cart-count]');
const quoteCart = document.getElementById('quote-cart');
const quoteClose = document.getElementById('quote-close');
const quoteStorageKey = 'td-quote-cart';
const maxQuantity = 999;
const quoteProducts = [...document.querySelectorAll('[data-quote-add]')].map(button => ({
  button,
  id: button.dataset.quoteAdd,
  name: button.closest('article').querySelector('h3').textContent
}));
const quoteItems = document.getElementById('quote-items');
let cart = {};
try {
  const saved = JSON.parse(localStorage.getItem(quoteStorageKey));
  for (const { id } of quoteProducts) {
    const quantity = saved?.[id];
    if (Number.isInteger(quantity) && quantity > 0 && quantity <= maxQuantity) cart[id] = quantity;
  }
} catch {
  // The cart remains usable for the current visit when storage is unavailable.
}
let draft = '';

function quoteText() {
  return quoteProducts.filter(({ id }) => cart[id])
    .map(({ id, name }) => '• ' + name + ' × ' + cart[id]).join('\n');
}

function updateCart() {
  const total = quoteProducts.reduce((sum, product) => {
    const quantity = cart[product.id] || 0;
    product.row.hidden = !quantity;
    product.input.value = quantity || 1;
    return sum + quantity;
  }, 0);
  cartCounts.forEach(count => { count.textContent = total; });
  cartButtons.forEach(button => button.setAttribute('aria-label', 'Giỏ báo giá, số lượng ' + total));
  document.getElementById('quote-empty').hidden = total > 0;
  quoteContinue.disabled = !total || supportSubmit.disabled;
  try {
    localStorage.setItem(quoteStorageKey, JSON.stringify(cart));
  } catch {
    // A blocked storage write does not affect the current cart.
  }
}

function reportCartChange(message) {
  (quoteCart.open ? quoteStatus : quoteCatalogStatus).textContent = message;
}

function changeQuantity(product, quantity) {
  if (quantity === 0) delete cart[product.id];
  else cart[product.id] = quantity;
  updateCart();
  if (draft && !supportSubmit.disabled) setQuoteDraft(quoteText());
  reportCartChange(quantity ? product.name + ' · Số lượng ' + quantity : 'Đã bỏ ' + product.name);
}

for (const product of quoteProducts) {
  const row = document.createElement('li');
  row.className = 'quote-row';
  const name = document.createElement('span');
  name.textContent = product.name;
  const quantity = document.createElement('input');
  quantity.type = 'number';
  quantity.min = 1;
  quantity.max = maxQuantity;
  quantity.setAttribute('aria-label', 'Số lượng ' + product.name);
  quantity.addEventListener('change', () => {
    const value = quantity.valueAsNumber;
    if (Number.isInteger(value) && value >= 1 && value <= maxQuantity) {
      changeQuantity(product, value);
    } else {
      quantity.value = cart[product.id];
      reportCartChange('Số lượng phải từ 1 đến ' + maxQuantity + '.');
    }
  });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'btn light small';
  remove.textContent = 'Xóa';
  remove.setAttribute('aria-label', 'Xóa ' + product.name + ' khỏi giỏ');
  remove.addEventListener('click', () => {
    changeQuantity(product, 0);
    (quoteProducts.find(({ id }) => cart[id])?.input || quoteClose).focus();
  });
  product.button.addEventListener('click', () => {
    const next = (cart[product.id] || 0) + 1;
    if (next <= maxQuantity) changeQuantity(product, next);
    else reportCartChange('Mỗi mặt hàng tối đa ' + maxQuantity + ' đơn vị.');
  });
  row.append(name, quantity, remove);
  quoteItems.append(row);
  product.row = row;
  product.input = quantity;
}
updateCart();
cartButtons.forEach(button => {
  button.addEventListener('click', () => {
    quoteStatus.textContent = '';
    quoteCart.showModal();
  });
});

function setQuoteDraft(items) {
  draft = items;
  quoteDraft.hidden = !draft;
  document.getElementById('quote-draft-items').textContent = draft;
  supportDescription.required = !draft;
  supportSubmit.textContent = draft ? 'Gửi yêu cầu báo giá ↗' : 'Gửi yêu cầu ↗';
}

quoteContinue.addEventListener('click', () => {
  setQuoteDraft(quoteText());
  if (!supportEquipment.value) supportEquipment.value = 'Khác';
  quoteCart.close();
  supportForm.elements.namedItem('customer').focus();
});
quoteCancel.addEventListener('click', () => {
  setQuoteDraft('');
  supportDescription.focus();
});

supportForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (supportSubmit.disabled) return;

  const fields = new FormData(supportForm);
  const customer = fields.get('customer').trim();
  const callback = normalizePhone(fields.get('callback'));
  const notes = fields.get('description').trim();
  const submittedQuote = draft;
  const description = submittedQuote
    ? 'Yêu cầu báo giá\n' + submittedQuote + (notes ? '\nGhi chú: ' + notes : '')
    : notes;

  if (!customer || !callback || !description) {
    supportFormNote.textContent = 'Vui lòng điền họ tên, số điện thoại Việt Nam hợp lệ và nội dung hỗ trợ.';
    supportForm.elements.namedItem(!customer ? 'customer' : !callback ? 'callback' : 'description').focus();
    return;
  }
  if (Array.from(description).length > 500) {
    supportFormNote.textContent = 'Danh sách và ghi chú tối đa 500 ký tự. Vui lòng rút gọn ghi chú.';
    supportDescription.focus();
    return;
  }

  supportSubmit.disabled = true;
  quoteContinue.disabled = true;
  quoteCancel.disabled = true;
  supportFormNote.textContent = 'Đang gửi yêu cầu…';
  try {
    if (!useSupabase) throw new Error('Supabase chưa được cấu hình');
    const response = await fetch(supabaseUrl + '/rest/v1/rpc/td_submit_support', {
      method: 'POST',
      headers: { apikey: supabaseConfig.publishableKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_customer: customer,
        p_phone: displayPhone(callback),
        p_equipment: fields.get('equipment'),
        p_description: description
      }),
      signal: AbortSignal.timeout(20000)
    });
    const result = response.ok ? await response.json() : null;
    if (result !== true) {
      throw new Error('Yêu cầu chưa được xác nhận');
    }
    supportForm.reset();
    if (submittedQuote && submittedQuote === quoteText()) cart = {};
    setQuoteDraft('');
    supportFormNote.textContent = submittedQuote
      ? 'Đã gửi yêu cầu báo giá. TĐ sẽ liên hệ lại qua số điện thoại bạn cung cấp.'
      : 'Đã gửi yêu cầu. TĐ sẽ liên hệ lại qua số điện thoại bạn cung cấp.';
  } catch {
    supportFormNote.textContent = 'Chưa xác nhận được yêu cầu. Bạn có thể liên hệ qua Zalo hoặc gọi hotline.';
  } finally {
    supportSubmit.disabled = false;
    quoteCancel.disabled = false;
    updateCart();
  }
});
