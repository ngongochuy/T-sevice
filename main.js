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
    link.href = '#lien-he';
    link.removeAttribute('target');
    link.removeAttribute('rel');
    link.setAttribute('aria-disabled', 'true');
    link.title = 'Số liên hệ đang được cập nhật';
    link.addEventListener('click', event => {
      event.preventDefault();
      document.getElementById('lien-he').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
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
  nav.classList.toggle('is-open', open);
});
function closeMenu() { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); }
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('is-open')) { closeMenu(); toggle.focus(); } });

// Chỉ hiển thị ảnh công việc của TĐ khi tải được tệp tương ứng.
document.querySelectorAll('[data-work-photo]').forEach(figure => {
  const photo = new Image();
  photo.alt = figure.dataset.photoAlt;
  photo.addEventListener('load', () => {
    figure.prepend(photo);
    figure.hidden = false;
    figure.closest('.work-photos').hidden = false;
  }, { once: true });
  photo.src = figure.dataset.workPhoto;
});

document.querySelectorAll('.service-card').forEach(card => {
  const details = card.querySelector('details');
  card.addEventListener('click', event => {
    if (event.target.closest('summary, .service-article')) return;
    details.open = !details.open;
  });
});

const supportEndpoint = 'https://script.google.com/macros/s/AKfycbwGBjHQfTEOwvf3odfgYwTj45VuYvVQ_nRQiu4EYkwFhHBxHvFXLHHxaw50ipUfCAi-NA/exec'; // URL /exec của Apps Script.
const supportForm = document.getElementById('support-form');
const supportFormNote = document.getElementById('support-form-note');

if (!phone && !supportEndpoint) {
  supportForm.querySelector('button').disabled = true;
  supportFormNote.textContent = 'Số nhận yêu cầu đang được cập nhật.';
}

const supportSubmit = supportForm.querySelector('button');
if (supportEndpoint) {
  supportSubmit.textContent = 'Gửi yêu cầu';
  supportFormNote.textContent = 'TĐ sẽ dùng số điện thoại bạn cung cấp để phản hồi.';
}

supportForm.addEventListener('submit', async event => {
  event.preventDefault();

  const fields = new FormData(supportForm);
  const customer = fields.get('customer').trim();
  const callback = normalizePhone(fields.get('callback'));
  const description = fields.get('description').trim();

  if (!customer || !callback || !description) {
    supportFormNote.textContent = 'Vui lòng điền họ tên, số điện thoại Việt Nam hợp lệ và nội dung hỗ trợ.';
    supportForm.elements.namedItem(!customer ? 'customer' : !callback ? 'callback' : 'description').focus();
    return;
  }

  if (supportEndpoint) {
    supportSubmit.disabled = true;
    supportFormNote.textContent = 'Đang gửi yêu cầu…';
    try {
      fields.set('customer', customer);
      fields.set('callback', displayPhone(callback));
      fields.set('description', description);
      const response = await fetch(supportEndpoint, {
        method: 'POST',
        body: new URLSearchParams(fields),
        signal: AbortSignal.timeout(20000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Yêu cầu chưa được xác nhận');
      supportForm.reset();
      supportFormNote.textContent = 'Đã gửi yêu cầu. TĐ sẽ liên hệ lại qua số điện thoại bạn cung cấp.';
    } catch {
      supportFormNote.textContent = 'Chưa xác nhận được yêu cầu. Bạn có thể liên hệ qua Zalo hoặc gọi hotline.';
    } finally {
      supportSubmit.disabled = false;
    }
    return;
  }

  const message = [
    'Yêu cầu hỗ trợ TĐ Technical Service',
    'Họ tên: ' + customer,
    'SĐT: ' + displayPhone(callback),
    'Thiết bị: ' + fields.get('equipment'),
    'Nội dung: ' + description
  ].join('\n');

  const separator = /iPad|iPhone|iPod/.test(navigator.userAgent) ? '&' : '?';
  supportFormNote.textContent = 'Kiểm tra nội dung và bấm gửi trong ứng dụng Tin nhắn. Nếu ứng dụng không mở trên máy tính, hãy dùng điện thoại.';
  window.location.href = 'sms:+' + phone + separator + 'body=' + encodeURIComponent(message);
});
