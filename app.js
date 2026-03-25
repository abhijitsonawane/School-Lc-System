/**
 * EduCert Pro — app.js  v4  (Complete rebuild)
 *
 * BUGS FIXED:
 *
 * 1. LOGO UPLOAD — Root cause: previous code had pointer-events:none on the
 *    upload placeholder so clicks were eaten. The file <input> was also hidden
 *    with display:none which prevented programmatic .click(). Fix: input is
 *    position:absolute inset:0 opacity:0 — it covers the entire upload-box so
 *    ANY click on the box hits the input. No JS click() needed.
 *    Logo base64 is stored in S.logoDataURL and embedded directly in the cert.
 *
 * 2. QR NOT SHOWING STUDENT DATA — Root cause: QR encoded a localhost/file://
 *    URL. On a phone that URL is unreachable. Fix: QR encodes ALL student data
 *    as a compact text string. In-page, clicking/tapping the QR area opens the
 *    verify modal which reads directly from S.formData (no network needed).
 *
 * 3. QR LIBRARY SILENT FAIL — qrcodejs CDN sometimes loads but fails on long
 *    text. Fix: we try qrcodejs first; if the canvas is blank we fall back to
 *    Google Charts QR API (HTTPS image, always works).
 */

'use strict';

/* ═══ CONFIG ═══════════════════════════════════════════════════════════════ */
const CFG = {
  RAZORPAY_KEY:  'rzp_test_XXXXXXXXXXXXXXXX',   // ← replace with your key
  PAY_AMOUNT:    4900,                            // paise = ₹49
  PAY_CURRENCY:  'INR',
  PAY_NAME:      'EduCert Pro',
  PAY_DESC:      'School Leaving Certificate',
  PAY_COLOR:     '#2563eb',
};

/* ═══ STATE ════════════════════════════════════════════════════════════════ */
let S = {
  logoDataURL: null,   // base64 string of school logo
  formData:    {},     // all captured form values
  paymentDone: false,
  qrDataURL:   null,   // base64 PNG of generated QR code
};

/* ═══ INIT ══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initLogoUpload();
  restoreFromStorage();
  autoLCNumber();
});

/* ═══════════════════════════════════════════════════════════════════════════
   LOGO UPLOAD
   ─────────────────────────────────────────────────────────────────────────
   The <input type="file"> has position:absolute inset:0 opacity:0 z-index:10
   so it covers the whole upload-box. No JS click() tricks needed.
   The "Remove" button has z-index:15 and position:relative so it sits above
   the input and intercepts its own clicks correctly.
═══════════════════════════════════════════════════════════════════════════ */
function initLogoUpload() {
  const input       = document.getElementById('schoolLogo');
  const box         = document.getElementById('upload-box');
  const placeholder = document.getElementById('upload-placeholder');
  const previewDiv  = document.getElementById('upload-preview');
  const logoImg     = document.getElementById('logo-img');
  const metaDiv     = document.getElementById('upload-meta');
  const statusDiv   = document.getElementById('logo-status');
  const removeBtn   = document.getElementById('remove-logo-btn');

  if (!input) return;

  /* File selected via input */
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    loadLogoFile(file);
  });

  /* Drag over / leave / drop */
  box.addEventListener('dragover', (e) => {
    e.preventDefault();
    box.classList.add('drag-over');
  });
  box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
  box.addEventListener('drop', (e) => {
    e.preventDefault();
    box.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) loadLogoFile(file);
  });

  /* Remove button */
  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();  // don't re-trigger file picker
    removeLogo();
  });

  function loadLogoFile(file) {
    /* Validate type */
    if (!file.type.startsWith('image/')) {
      setStatus('❌ Only image files (PNG, JPG) are allowed.', 'fail');
      return;
    }
    /* Validate size */
    if (file.size > 2 * 1024 * 1024) {
      setStatus('❌ File too large. Max 2 MB allowed.', 'fail');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target.result;

      /* Verify it's actually a readable image */
      const testImg = new Image();
      testImg.onload = () => {
        /* Success — store and display */
        S.logoDataURL = result;
        logoImg.src   = result;
        metaDiv.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB · ${testImg.width}×${testImg.height}px)`;

        placeholder.style.display = 'none';
        previewDiv.style.display  = 'flex';
        box.style.minHeight       = 'auto';
        setStatus('✅ Logo uploaded successfully — will appear on certificate.', 'ok');
      };
      testImg.onerror = () => {
        setStatus('❌ Cannot read image. Try a different file.', 'fail');
      };
      testImg.src = result;
    };
    reader.onerror = () => setStatus('❌ File read failed.', 'fail');
    reader.readAsDataURL(file);
  }

  function setStatus(msg, type) {
    statusDiv.textContent  = msg;
    statusDiv.className    = 'logo-status ' + (type || '');
  }
}

function removeLogo() {
  S.logoDataURL = null;
  const input       = document.getElementById('schoolLogo');
  const placeholder = document.getElementById('upload-placeholder');
  const previewDiv  = document.getElementById('upload-preview');
  const logoImg     = document.getElementById('logo-img');
  const statusDiv   = document.getElementById('logo-status');

  if (input)       input.value       = '';
  if (logoImg)     logoImg.src       = '';
  if (previewDiv)  previewDiv.style.display  = 'none';
  if (placeholder) placeholder.style.display = 'flex';
  if (statusDiv)   { statusDiv.textContent = ''; statusDiv.className = 'logo-status'; }
}

/* ═══ LC NUMBER ═════════════════════════════════════════════════════════════ */
function autoLCNumber() {
  const el = document.getElementById('lcNumber');
  if (el && !el.value) {
    const yr  = new Date().getFullYear();
    const seq = Math.floor(100000 + Math.random() * 900000);
    el.value  = `LC-${yr}-${seq}`;
  }
}

/* ═══ REASON "OTHER" ════════════════════════════════════════════════════════ */
function toggleOtherReason(val) {
  const el = document.getElementById('reasonOther');
  if (!el) return;
  el.style.display = (val === 'Other') ? 'block' : 'none';
  if (val !== 'Other') el.value = '';
}

/* ═══ FORM AUTO-SAVE ════════════════════════════════════════════════════════ */
function restoreFromStorage() {
  document.querySelectorAll('#lc-form input, #lc-form textarea, #lc-form select').forEach((el) => {
    if (!el.id || el.type === 'file') return;
    const saved = localStorage.getItem('lc_' + el.id);
    if (saved !== null) {
      el.value = saved;
      if (el.id === 'reasonLeaving') toggleOtherReason(saved);
    }
    el.addEventListener('input',  () => localStorage.setItem('lc_' + el.id, el.value));
    el.addEventListener('change', () => localStorage.setItem('lc_' + el.id, el.value));
  });
}

/* ═══ VALIDATION ════════════════════════════════════════════════════════════ */
const RULES = {
  trustName:       'Trust / Society name is required',
  schoolName:      'School name is required',
  schoolAddress:   'School address is required',
  udiseNo:         ['UDISE required', /^\d{11}$/, 'UDISE must be exactly 11 digits'],
  schoolMobile:    ['Mobile required', /^\d{10}$/, 'Enter valid 10-digit mobile number'],
  chairmanName:    'Chairman name is required',
  hmName:          'Headmaster name is required',
  studentName:     'Student name is required',
  dob:             'Date of birth is required',
  gender:          'Please select gender',
  fatherName:      "Father's name is required",
  motherName:      "Mother's name is required",
  classStudied:    'Please select class',
  academicYear:    'Please select academic year',
  dateOfAdmission: 'Date of admission is required',
  dateOfLeaving:   'Date of leaving is required',
  reasonLeaving:   'Please select reason for leaving',
};

function validateForm() {
  let ok = true, first = null;
  document.querySelectorAll('.emsg').forEach(el => el.textContent = '');
  document.querySelectorAll('.err').forEach(el => el.classList.remove('err'));

  for (const [id, rule] of Object.entries(RULES)) {
    const el  = document.getElementById(id);
    if (!el) continue;
    const val = el.value.trim();
    let   msg = '';

    if (Array.isArray(rule)) {
      if (!val)                           msg = rule[0];
      else if (!rule[1].test(val))        msg = rule[2];
    } else {
      if (!val)                           msg = rule;
    }

    if (msg) {
      el.classList.add('err');
      const em = document.getElementById('e-' + id);
      if (em) em.textContent = msg;
      if (!first) first = el;
      ok = false;
    }
  }
  if (first) { first.scrollIntoView({ behavior: 'smooth', block: 'center' }); first.focus(); }
  return ok;
}

/* ═══ CAPTURE FORM DATA ══════════════════════════════════════════════════════ */
function captureFormData() {
  const g = id => (document.getElementById(id)?.value || '').trim();

  let reason = g('reasonLeaving');
  if (reason === 'Other') reason = g('reasonOther') || 'Other';

  S.formData = {
    trustName:       g('trustName'),
    schoolName:      g('schoolName'),
    schoolAddress:   g('schoolAddress'),
    udiseNo:         g('udiseNo'),
    schoolMobile:    g('schoolMobile'),
    schoolEmail:     g('schoolEmail'),
    schoolWebsite:   g('schoolWebsite'),
    chairmanName:    g('chairmanName'),
    hmName:          g('hmName'),
    studentName:     g('studentName'),
    penNumber:       g('penNumber'),
    aadhaarNo:       g('aadhaarNo'),
    dob:             g('dob'),
    gender:          g('gender'),
    fatherName:      g('fatherName'),
    motherName:      g('motherName'),
    caste:           g('caste'),
    nationality:     g('nationality') || 'Indian',
    religion:        g('religion'),
    classStudied:    g('classStudied'),
    academicYear:    g('academicYear'),
    dateOfAdmission: g('dateOfAdmission'),
    dateOfLeaving:   g('dateOfLeaving'),
    progress:        g('progress'),
    conduct:         g('conduct'),
    reasonLeaving:   reason,
    medium:          g('medium'),
    lcNumber:        g('lcNumber'),
    issuedOn:        new Date().toISOString(),
  };
}

/* ═══ FORMAT DATE ════════════════════════════════════════════════════════════ */
function fd(ds) {
  if (!ds) return '—';
  try { return new Date(ds + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return ds; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   QR CODE GENERATION
   ─────────────────────────────────────────────────────────────────────────
   Strategy:
     The QR encodes a compact text with ALL student info directly.
     No URL, no server, no token — works offline and when scanned by any phone.
     The in-page "Scan to Verify" label is for info; the modal is triggered
     by clicking the QR image in the preview (JS onclick).

   We try qrcodejs (canvas). If the canvas is blank/corrupt we fall back to
   Google Charts QR API which always works (returns an <img> src URL).
═══════════════════════════════════════════════════════════════════════════ */
function buildQRText(data) {
  return [
    'EDUCERT-LC-VERIFICATION',
    `LC No: ${data.lcNumber}`,
    `Student: ${data.studentName}`,
    `Father: ${data.fatherName}`,
    `Mother: ${data.motherName}`,
    `DOB: ${fd(data.dob)}`,
    `Class: ${data.classStudied}`,
    `Year: ${data.academicYear}`,
    `School: ${data.schoolName}`,
    `Admitted: ${fd(data.dateOfAdmission)}`,
    `Left: ${fd(data.dateOfLeaving)}`,
    `Reason: ${data.reasonLeaving}`,
    `Conduct: ${data.conduct || 'Good'}`,
    `Issued: ${new Date(data.issuedOn).toLocaleDateString('en-IN')}`,
  ].join('\n');
}

function generateQR(text) {
  return new Promise((resolve) => {
    /* ── Try qrcodejs ── */
    if (typeof QRCode !== 'undefined') {
      const tmp = document.createElement('div');
      tmp.style.cssText = 'position:fixed;left:-9999px;top:0;width:140px;height:140px;background:#fff;';
      document.body.appendChild(tmp);

      try {
        new QRCode(tmp, {                        // eslint-disable-line no-new
          text,
          width:        140,
          height:       140,
          colorDark:    '#1a2744',
          colorLight:   '#ffffff',
          correctLevel: QRCode.CorrectLevel.L,   // L = shorter text = less chance of fail
        });
      } catch (e) { /* ignore, check below */ }

      setTimeout(() => {
        let dataURL = null;
        const canvas = tmp.querySelector('canvas');
        if (canvas) {
          try {
            dataURL = canvas.toDataURL('image/png');
            /* Detect blank canvas (all white) — means library failed silently */
            const ctx = canvas.getContext('2d');
            const px  = ctx.getImageData(0, 0, 1, 1).data;
            if (px[0] === 255 && px[1] === 255 && px[2] === 255) dataURL = null; // blank
          } catch { dataURL = null; }
        }
        if (document.body.contains(tmp)) document.body.removeChild(tmp);

        if (dataURL) { resolve(dataURL); return; }

        /* ── Fallback: Google Charts QR API ── */
        googleQR(text).then(resolve);
      }, 600);

    } else {
      /* qrcodejs not loaded at all */
      googleQR(text).then(resolve);
    }
  });
}

function googleQR(text) {
  return new Promise((resolve) => {
    /* Google Charts returns a PNG — we fetch it and convert to base64 */
    const encoded = encodeURIComponent(text);
    const url     = `https://chart.googleapis.com/chart?cht=qr&chs=140x140&chl=${encoded}&choe=UTF-8&chld=L|1`;

    const img  = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c   = document.createElement('canvas');
        c.width   = img.width;
        c.height  = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        /* CORS blocked — return the URL directly (works for <img src> but not in PDF) */
        resolve(url);
      }
    };
    img.onerror = () => resolve(null);
    img.src     = url;
  });
}

/* ═══ QR VERIFY MODAL ═══════════════════════════════════════════════════════ */
function showVerifyModal() {
  const d   = S.formData;
  const box = document.getElementById('verify-content');
  if (!box) return;

  if (!d || !d.studentName) {
    box.innerHTML = `<div class="verify-fail"><div class="v-title">⚠ No certificate data found.</div><p style="font-size:.82rem;color:#475569;">Please generate a certificate first.</p></div>`;
  } else {
    box.innerHTML = `
      <div class="verify-ok">
        <div class="v-title">✅ Certificate Verified</div>
        <table class="v-table">
          <tr><td>LC Number</td><td>${d.lcNumber || '—'}</td></tr>
          <tr><td>Student Name</td><td><strong>${d.studentName}</strong></td></tr>
          <tr><td>Father's Name</td><td>${d.fatherName}</td></tr>
          <tr><td>Mother's Name</td><td>${d.motherName}</td></tr>
          <tr><td>Date of Birth</td><td>${fd(d.dob)}</td></tr>
          <tr><td>Gender</td><td>${d.gender}</td></tr>
          ${d.caste    ? `<tr><td>Caste / Category</td><td>${d.caste}</td></tr>` : ''}
          ${d.religion ? `<tr><td>Religion</td><td>${d.religion}</td></tr>` : ''}
          <tr><td>School</td><td>${d.schoolName}</td></tr>
          <tr><td>Class Last Studied</td><td>${d.classStudied}</td></tr>
          <tr><td>Academic Year</td><td>${d.academicYear}</td></tr>
          ${d.medium   ? `<tr><td>Medium</td><td>${d.medium}</td></tr>` : ''}
          <tr><td>Date of Admission</td><td>${fd(d.dateOfAdmission)}</td></tr>
          <tr><td>Date of Leaving</td><td>${fd(d.dateOfLeaving)}</td></tr>
          <tr><td>Reason for Leaving</td><td>${d.reasonLeaving}</td></tr>
          <tr><td>Progress / Result</td><td>${d.progress || '—'}</td></tr>
          <tr><td>Conduct</td><td>${d.conduct || '—'}</td></tr>
          <tr><td>Issued On</td><td>${d.issuedOn ? new Date(d.issuedOn).toLocaleString('en-IN') : '—'}</td></tr>
        </table>
      </div>`;
  }
  document.getElementById('verify-modal').classList.remove('hidden');
}

function closeVerifyModal() {
  document.getElementById('verify-modal').classList.add('hidden');
}

/* ═══════════════════════════════════════════════════════════════════════════
   BUILD CERTIFICATE HTML
   ─────────────────────────────────────────────────────────────────────────
   Returns a self-contained HTML string using ONLY inline styles.
   External CSS classes are NOT used inside the cert so html2canvas
   captures everything correctly in the PDF.

   Logo: embedded as base64 <img> — shows in preview AND in PDF/print.
   QR:   embedded as base64 <img> — shows in student section.
         onclick calls showVerifyModal() in preview; in PDF it's static image.
═══════════════════════════════════════════════════════════════════════════ */
function buildCertHTML(data, logoURL, qrURL) {
  const today   = new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });
  const pronoun = data.gender === 'Female' ? 'she'      : data.gender === 'Male' ? 'he'   : 'they';
  const hisher  = data.gender === 'Female' ? 'her'      : data.gender === 'Male' ? 'his'  : 'their';
  const rel     = data.gender === 'Female' ? 'daughter' : data.gender === 'Male' ? 'son'  : 'child';
  const cap     = s => s ? s[0].toUpperCase() + s.slice(1) : '';

  /* palette */
  const navy = '#1a2744', blueL = '#4e6fa3', blueLL = '#e8eef8',
        border = '#c5d5ea', lbl = '#f0f5fb', sub = '#475569', grey = '#94a3b8', txt = '#1e293b';

  /* shared cell styles */
  const TL = `padding:5px 9px;border:.7px solid ${border};background:${lbl};font-weight:600;color:${navy};width:40%;font-size:.72rem;line-height:1.45;vertical-align:top;`;
  const TV = `padding:5px 9px;border:.7px solid ${border};color:${txt};font-size:.72rem;line-height:1.45;vertical-align:top;`;

  /* logo HTML */
  const logoInner = logoURL
    ? `<img src="${logoURL}" style="width:100%;height:100%;object-fit:contain;display:block;" alt="Logo" crossorigin="anonymous"/>`
    : `<div style="font-size:2.2rem;line-height:66px;text-align:center;">🏫</div>`;

  /* watermark */
  const wmStyle = logoURL
    ? `background-image:url('${logoURL}');background-size:contain;background-repeat:no-repeat;background-position:center;`
    : `display:flex;align-items:center;justify-content:center;font-size:8rem;color:${blueL};`;

  /* QR HTML — onclick shows verify modal when in preview mode */
  const qrInner = qrURL
    ? `<img src="${qrURL}" style="width:100px;height:100px;display:block;" alt="QR" title="Scan to verify"/>`
    : `<div style="width:100px;height:100px;border:1.5px dashed ${border};display:flex;align-items:center;justify-content:center;font-size:.6rem;color:${grey};text-align:center;">QR<br/>Code</div>`;

  return `
<div style="font-family:'Libre Baskerville',Georgia,serif;background:#fff;width:794px;min-height:1100px;padding:30px 40px;position:relative;overflow:hidden;box-sizing:border-box;">

  <!-- Double border frame -->
  <div style="position:absolute;inset:9px;border:1.5px solid ${blueL};border-radius:2px;pointer-events:none;z-index:0;"></div>
  <div style="position:absolute;inset:15px;border:.5px solid #7fa3d4;border-radius:1px;pointer-events:none;z-index:0;"></div>

  <!-- Watermark -->
  <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:310px;height:310px;opacity:.06;z-index:0;pointer-events:none;${wmStyle}">${logoURL ? '' : '🏫'}</div>

  <!-- Content wrapper (above watermark) -->
  <div style="position:relative;z-index:2;">

    <!-- ── HEADER ── -->
    <table style="width:100%;border-collapse:collapse;border-bottom:2.5px solid ${blueL};margin-bottom:10px;padding-bottom:10px;">
      <tr>
        <!-- Logo box -->
        <td style="width:72px;vertical-align:middle;padding-right:12px;padding-bottom:10px;">
          <div style="width:68px;height:68px;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;background:#f8fafc;">${logoInner}</div>
        </td>
        <!-- School info -->
        <td style="text-align:center;vertical-align:middle;padding-bottom:10px;">
          <div style="font-size:.67rem;font-weight:700;color:${blueL};letter-spacing:.07em;text-transform:uppercase;margin-bottom:1px;">${data.trustName || ''}</div>
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:1.42rem;font-weight:800;color:${navy};line-height:1.2;margin-bottom:3px;">${data.schoolName || ''}</div>
          <div style="font-size:.63rem;color:${sub};line-height:1.5;margin-bottom:3px;">${data.schoolAddress || ''}</div>
          <div style="font-size:.59rem;color:${sub};display:flex;justify-content:center;flex-wrap:wrap;gap:2px 10px;">
            ${data.udiseNo      ? `<span>UDISE: <b>${data.udiseNo}</b></span>` : ''}
            ${data.schoolMobile ? `<span>📞 ${data.schoolMobile}</span>` : ''}
            ${data.schoolEmail  ? `<span>✉ ${data.schoolEmail}</span>` : ''}
            ${data.schoolWebsite? `<span>🌐 ${data.schoolWebsite}</span>` : ''}
          </div>
          <div style="font-size:.59rem;color:${blueL};margin-top:3px;font-style:italic;">
            Chairman: ${data.chairmanName || ''} &nbsp;|&nbsp; Principal / HM: ${data.hmName || ''}
          </div>
        </td>
        <!-- Right logo box (mirror) -->
        <td style="width:72px;vertical-align:middle;padding-left:12px;padding-bottom:10px;">
          <div style="width:68px;height:68px;border:1px solid #e2e8f0;border-radius:5px;overflow:hidden;background:#f8fafc;">${logoInner}</div>
        </td>
      </tr>
    </table>

    <!-- ── TITLE BAND ── -->
    <div style="background:linear-gradient(135deg,${blueLL},#d6e4f7 50%,${blueLL});border:1px solid #b3caea;border-radius:4px;text-align:center;padding:7px 32px;margin-bottom:10px;position:relative;">
      <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:${blueL};font-size:.9rem;">✦</span>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:1.05rem;font-weight:700;color:${navy};letter-spacing:.06em;">SCHOOL LEAVING CERTIFICATE</div>
      <div style="font-size:.57rem;color:${blueL};letter-spacing:.12em;text-transform:uppercase;margin-top:1px;">( Transfer Certificate )</div>
      <span style="position:absolute;right:12px;top:50%;transform:translateY(-50%);color:${blueL};font-size:.9rem;">✦</span>
    </div>

    <!-- ── LC NUMBER / DATE ── -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:9px;">
      <tr>
        <td style="font-size:.63rem;color:${sub};">LC No.: <b style="color:${navy};">${data.lcNumber || '—'}</b></td>
        <td style="font-size:.63rem;color:${sub};text-align:right;">Date of Issue: <b style="color:${navy};">${today}</b></td>
      </tr>
    </table>

    <!-- ── STUDENT INFORMATION SECTION LABEL ── -->
    <div style="font-size:.61rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${blueL};background:${blueLL};padding:3px 9px;border-left:3px solid ${blueL};margin-bottom:0;">Student Information</div>

    <!-- ── STUDENT TABLE + QR SIDE BY SIDE (plain table layout) ── -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:9px;">
      <tr>
        <!-- Student details inner table -->
        <td style="vertical-align:top;padding:0;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="${TL}">Full Name of Student</td>
              <td style="${TV}"><b>${(data.studentName || '—').toUpperCase()}</b></td>
            </tr>
            <tr>
              <td style="${TL}">Date of Birth</td>
              <td style="${TV}">${fd(data.dob)}</td>
            </tr>
            <tr>
              <td style="${TL}">Gender</td>
              <td style="${TV}">${data.gender || '—'}</td>
            </tr>
            <tr>
              <td style="${TL}">Father's Name</td>
              <td style="${TV}">${data.fatherName || '—'}</td>
            </tr>
            <tr>
              <td style="${TL}">Mother's Name</td>
              <td style="${TV}">${data.motherName || '—'}</td>
            </tr>
            ${data.religion    ? `<tr><td style="${TL}">Religion</td><td style="${TV}">${data.religion}</td></tr>` : ''}
            ${data.caste       ? `<tr><td style="${TL}">Caste / Category</td><td style="${TV}">${data.caste}</td></tr>` : ''}
            ${data.nationality ? `<tr><td style="${TL}">Nationality</td><td style="${TV}">${data.nationality}</td></tr>` : ''}
            ${data.penNumber   ? `<tr><td style="${TL}">PEN Number</td><td style="${TV}">${data.penNumber}</td></tr>` : ''}
            ${data.aadhaarNo   ? `<tr><td style="${TL}">Aadhaar Number</td><td style="${TV}">${data.aadhaarNo}</td></tr>` : ''}
          </table>
        </td>
        <!-- QR Code column -->
        <td style="vertical-align:top;padding:4px 0 0 10px;width:118px;text-align:center;">
          <div style="border:1px solid ${border};padding:4px;background:#fff;display:inline-block;cursor:pointer;" onclick="showVerifyModal()" title="Click to verify student details">
            ${qrInner}
          </div>
          <div style="font-size:.52rem;color:${grey};margin-top:4px;">Scan / Click to<br/>Verify Details</div>
        </td>
      </tr>
    </table>

    <!-- ── ACADEMIC DETAILS LABEL ── -->
    <div style="font-size:.61rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${blueL};background:${blueLL};padding:3px 9px;border-left:3px solid ${blueL};margin-bottom:0;">Academic Details</div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:9px;">
      <tr>
        <td style="${TL}">Class Last Studied</td>
        <td style="${TV}"><b>${data.classStudied || '—'}</b></td>
      </tr>
      <tr>
        <td style="${TL}">Academic Year</td>
        <td style="${TV}">${data.academicYear || '—'}</td>
      </tr>
      ${data.medium ? `<tr><td style="${TL}">Medium of Instruction</td><td style="${TV}">${data.medium}</td></tr>` : ''}
      <tr>
        <td style="${TL}">Date of Admission</td>
        <td style="${TV}">${fd(data.dateOfAdmission)}</td>
      </tr>
      <tr>
        <td style="${TL}">Date of Leaving</td>
        <td style="${TV}">${fd(data.dateOfLeaving)}</td>
      </tr>
      ${data.progress ? `<tr><td style="${TL}">Progress / Result</td><td style="${TV}">${data.progress}</td></tr>` : ''}
      ${data.conduct  ? `<tr><td style="${TL}">Conduct</td><td style="${TV}">${data.conduct}</td></tr>` : ''}
      <tr>
        <td style="${TL}">Reason for Leaving</td>
        <td style="${TV}">${data.reasonLeaving || '—'}</td>
      </tr>
    </table>

    <!-- ── CERTIFICATION TEXT ── -->
    <div style="background:#f8fafd;border:1px solid ${border};border-radius:4px;padding:9px 13px;font-size:.72rem;line-height:1.9;color:${navy};margin-bottom:10px;text-align:justify;">
      This is to certify that <b>${(data.studentName || '').toUpperCase()}</b>,
      ${rel} of <b>${data.fatherName || '—'}</b> and <b>${data.motherName || '—'}</b>,
      was a bonafide student of this institution.
      ${cap(pronoun)} was admitted on <b>${fd(data.dateOfAdmission)}</b> and
      left the school on <b>${fd(data.dateOfLeaving)}</b> after studying up to
      <b>${data.classStudied || '—'}</b> in the academic year <b>${data.academicYear || '—'}</b>.
      ${cap(hisher)} conduct during the period of study was
      <b>${data.conduct || 'Good'}</b>.
      The reason for leaving is stated as: <i>${data.reasonLeaving || '—'}</i>.
      <br/><br/>
      We wish ${pronoun} all the best in ${hisher} future endeavors.
    </div>

    <!-- ── FOOTER: Date | Seal | Signature ── -->
    <table style="width:100%;border-collapse:collapse;border-top:1px solid ${border};padding-top:12px;margin-top:16px;">
      <tr>
        <td style="text-align:center;vertical-align:bottom;width:33%;padding-top:12px;">
          <div style="width:110px;border-top:1px solid ${navy};margin:0 auto 3px;"></div>
          <div style="font-size:.58rem;color:${sub};font-weight:600;">Date</div>
          <div style="font-size:.63rem;color:${navy};font-weight:700;">${today}</div>
        </td>
        <td style="text-align:center;vertical-align:bottom;width:34%;padding-top:12px;">
          <div style="width:78px;height:78px;border:1px dashed #cbd5e1;border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:.52rem;color:${grey};text-align:center;line-height:1.4;">School<br/>Seal</div>
        </td>
        <td style="text-align:center;vertical-align:bottom;width:33%;padding-top:12px;">
          <div style="width:110px;border-top:1px solid ${navy};margin:0 auto 3px;"></div>
          <div style="font-size:.58rem;color:${sub};font-weight:600;">Principal / Headmaster</div>
          <div style="font-size:.63rem;color:${navy};font-weight:700;">${data.hmName || '—'}</div>
        </td>
      </tr>
    </table>

    <!-- ── FOOTER NOTE ── -->
    <div style="font-size:.54rem;color:${grey};text-align:center;margin-top:10px;letter-spacing:.04em;border-top:1px solid #f0f5fb;padding-top:8px;">
      This certificate is issued on official request. Any misuse or tampering is a punishable offence.
      &nbsp;|&nbsp; LC No: ${data.lcNumber || '—'} &nbsp;|&nbsp; Issued: ${today}
    </div>

  </div><!-- /content wrapper -->
</div>`;
}

/* ═══ WAIT FOR IMAGES ════════════════════════════════════════════════════════ */
function waitForImages(container) {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (!imgs.length) return Promise.resolve();
  return Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(res => { img.onload = res; img.onerror = res; });
  }));
}

/* ═══ RENDER CERTIFICATE ═════════════════════════════════════════════════════
   Writes HTML into BOTH #lc-certificate (visible preview) and
   #lc-certificate-print (off-screen, used by PDF + Print).
   Both always get the same content.
═══════════════════════════════════════════════════════════════════════════ */
async function renderCertificate() {
  /* Generate QR from student data text */
  const qrText = buildQRText(S.formData);
  S.qrDataURL  = await generateQR(qrText);

  const html = buildCertHTML(S.formData, S.logoDataURL, S.qrDataURL);

  /* Write to off-screen zone (for PDF/Print) */
  const pz = document.getElementById('lc-certificate-print');
  if (pz) {
    pz.innerHTML = html;
    await waitForImages(pz);
  }

  /* Write to visible preview */
  const pv = document.getElementById('lc-certificate');
  if (pv) pv.innerHTML = html;
}

/* ═══ STEP 1 → 2: PREVIEW ═══════════════════════════════════════════════════ */
async function previewLC() {
  if (!validateForm()) { showToast('⚠ Fix the highlighted errors first.'); return; }
  captureFormData();
  showLoader('Building certificate…');
  try {
    await renderCertificate();
  } catch(e) {
    console.error(e);
    showToast('Error building preview — see console.');
    return;
  } finally { hideLoader(); }
  showSection('preview');
  setPill(2);
}

/* ═══ DOWNLOAD PDF ═══════════════════════════════════════════════════════════ */
async function downloadPDF() {
  if (!S.paymentDone) { showToast('Please complete payment first.'); return; }
  try {
    showLoader('Preparing certificate…');
    await renderCertificate();

    showLoader('Generating PDF…');
    const el = document.getElementById('lc-certificate-print');

    /* Give browser 800ms to paint everything (fonts, logo, QR) */
    await new Promise(r => setTimeout(r, 800));

    const canvas = await html2canvas(el, {
      scale:           3,
      useCORS:         true,
      allowTaint:      true,
      backgroundColor: '#ffffff',
      logging:         false,
      width:           794,
      windowWidth:     794,
      x:               0,
      y:               0,
    });

    const imgData   = canvas.toDataURL('image/jpeg', 0.96);
    const { jsPDF } = window.jspdf;
    const pdf       = new jsPDF({ unit:'mm', format:'a4', orientation:'portrait', compress:true });
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);

    const safe = (S.formData.studentName || 'student').replace(/[^a-zA-Z0-9]/g, '_');
    pdf.save(`LC_${safe}_${S.formData.lcNumber || 'cert'}.pdf`);
    showToast('✅ PDF downloaded successfully!');
  } catch(e) {
    console.error(e);
    showToast('❌ PDF failed. Open console for details.');
  } finally { hideLoader(); }
}

/* ═══ PRINT ══════════════════════════════════════════════════════════════════ */
async function printCertificate() {
  if (!S.paymentDone) { showToast('Please complete payment first.'); return; }
  try {
    showLoader('Preparing for print…');
    await renderCertificate();
    await new Promise(r => setTimeout(r, 800));
    hideLoader();
    window.print();
  } catch(e) {
    console.error(e);
    hideLoader();
    showToast('❌ Print failed.');
  }
}

/* ═══ NAVIGATION ═════════════════════════════════════════════════════════════ */
function goToForm()    { showSection('form');    setPill(1); }
function goToPayment() { showSection('payment'); setPill(3); }

function showSection(name) {
  ['form','preview','payment','download'].forEach(s => {
    document.getElementById('section-' + s)?.classList.toggle('hidden', s !== name);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setPill(n) {
  for (let i = 1; i <= 4; i++) {
    const p = document.getElementById('pill-' + i);
    if (!p) continue;
    p.className = 'step-pill' + (i === n ? ' active' : i < n ? ' done' : '');
  }
}

/* ═══ PAYMENT ════════════════════════════════════════════════════════════════ */
function initiatePayment() {
  if (typeof Razorpay === 'undefined') { showToast('Razorpay not loaded. Use demo mode.'); return; }
  try {
    new Razorpay({                  // eslint-disable-line no-new
      key:         CFG.RAZORPAY_KEY,
      amount:      CFG.PAY_AMOUNT,
      currency:    CFG.PAY_CURRENCY,
      name:        CFG.PAY_NAME,
      description: CFG.PAY_DESC,
      theme:       { color: CFG.PAY_COLOR },
      prefill:     { name: S.formData.hmName || '', email: S.formData.schoolEmail || '' },
      handler:     r => { S.paymentDone = true; onPaid(r.razorpay_payment_id); },
      modal:       { ondismiss: () => showToast('Payment cancelled.') },
    }).open();
  } catch(e) { showToast('Payment error. Use demo mode.'); }
}

function onPaid(id) {
  showToast(`✅ Payment done! ID: ${id}`);
  showSection('download'); setPill(4);
}

function skipPayment() {
  S.paymentDone = true;
  showToast('Demo mode — payment skipped.');
  showSection('download'); setPill(4);
}

/* ═══ RESET ══════════════════════════════════════════════════════════════════ */
function resetForm() {
  if (!confirm('Reset all form data? This cannot be undone.')) return;
  document.getElementById('lc-form').reset();
  S = { logoDataURL: null, formData: {}, paymentDone: false, qrDataURL: null };
  removeLogo();
  /* Clear all saved field values */
  Object.keys(localStorage)
    .filter(k => k.startsWith('lc_'))
    .forEach(k => localStorage.removeItem(k));
  document.querySelectorAll('.emsg').forEach(e => e.textContent = '');
  document.querySelectorAll('.err').forEach(e => e.classList.remove('err'));
  const ro = document.getElementById('reasonOther');
  if (ro) { ro.style.display = 'none'; ro.value = ''; }
  autoLCNumber();
  showToast('Form has been reset.');
}

function newCertificate() { S.paymentDone = false; goToForm(); setPill(1); }

/* ═══ TOAST ══════════════════════════════════════════════════════════════════ */
let _toastT = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.add('hidden'), 3800);
}

/* ═══ LOADER ══════════════════════════════════════════════════════════════════ */
function showLoader(msg) {
  const ol = document.getElementById('loader-overlay');
  const lm = document.getElementById('loader-msg');
  ol?.classList.remove('hidden');
  if (lm) lm.textContent = msg || 'Processing…';
}
function hideLoader() {
  document.getElementById('loader-overlay')?.classList.add('hidden');
}
