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
const supportSubmit = supportForm.querySelector('button');

supportForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (supportSubmit.disabled) return;

  const fields = new FormData(supportForm);
  const customer = fields.get('customer').trim();
  const callback = normalizePhone(fields.get('callback'));
  const description = fields.get('description').trim();

  if (!customer || !callback || !description) {
    supportFormNote.textContent = 'Vui lòng điền họ tên, số điện thoại Việt Nam hợp lệ và nội dung hỗ trợ.';
    supportForm.elements.namedItem(!customer ? 'customer' : !callback ? 'callback' : 'description').focus();
    return;
  }

  supportSubmit.disabled = true;
  supportFormNote.textContent = 'Đang gửi yêu cầu…';
  try {
    fields.set('customer', customer);
    fields.set('callback', displayPhone(callback));
    fields.set('description', description);
    const response = await fetch('/api/support', {
      method: 'POST',
      body: new URLSearchParams(fields),
      signal: AbortSignal.timeout(20000)
    });
    if (!response.ok || (await response.json()).ok !== true) {
      throw new Error('Yêu cầu chưa được xác nhận');
    }
    supportForm.reset();
    supportFormNote.textContent = 'Đã gửi yêu cầu. TĐ sẽ liên hệ lại qua số điện thoại bạn cung cấp.';
  } catch {
    supportFormNote.textContent = 'Chưa xác nhận được yêu cầu. Bạn có thể liên hệ qua Zalo hoặc gọi hotline.';
  } finally {
    supportSubmit.disabled = false;
  }
});
