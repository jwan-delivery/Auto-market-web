/* الملهلب — connected client for Supabase Auth, Database and Storage */
const STORAGE_THEME_KEY = "almalhalab-theme";
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[char]));

const cfg = window.SUPABASE_CONFIG || {};
const keyIsReady = Boolean(cfg.anonKey && !String(cfg.anonKey).includes("PASTE_"));
const db = keyIsReady && window.supabase
  ? window.supabase.createClient(cfg.url, cfg.anonKey)
  : null;

let cars = [];
let currentUser = null;
let currentProfile = null;
let userRole = "user";
let editingId = null;
let authMode = "signin";
let carAlertChannel = null;
let carAlertPollTimer = null;
let alertedCarIds = new Set();
let latestAlertCreatedAt = "";

const authDialog = $("authDialog");
const carDialog = $("carDialog");
const carForm = $("carForm");

function toast(message) {
  const node = $("toast");
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { node.hidden = true; }, 3800);
}

function setStatus(message) {
  const node = $("statusNote");
  if (node) node.textContent = message;
}

function isAdmin() {
  return Boolean(currentUser && userRole === "admin");
}

function safeHttpUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
  } catch {
    return "";
  }
}

function whatsappNumber(phone) {
  return String(phone || "").replace(/[^\d]/g, "").replace(/^00/, "");
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US") + " جنيه سوداني";
}

function description(car) {
  return [
    [car.brand, car.model].filter(Boolean).join(" ") + (car.year ? " موديل " + car.year + "." : "."),
    car.type && "النوع: " + car.type + ".",
    car.color && "اللون: " + car.color + ".",
    car.transmission && "القير: " + car.transmission + ".",
    car.fuel && "الوقود: " + car.fuel + ".",
    car.document && "المستند: " + car.document + ".",
    car.extra
  ].filter(Boolean).join("\n");
}

function mapDatabaseCar(row) {
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  return {
    recordId: row.id,
    id: row.offer_number,
    ownerId: row.owner_id,
    brand: row.brand,
    model: row.model,
    year: Number(row.year),
    price: Number(row.price_sdg),
    state: row.state,
    type: row.car_type || "",
    color: row.color || "",
    transmission: row.transmission || "",
    fuel: row.fuel || "",
    document: row.document_type || "",
    licenseState: row.license_state || "",
    phone: row.phone || "",
    imageUrls,
    image: imageUrls[0] || "",
    video: row.video_url || "",
    extra: row.extra_description || "",
    sold: Boolean(row.is_sold),
    published: Boolean(row.is_published),
    createdAt: row.created_at
  };
}

function currentFilters() {
  return {
    q: ($("search")?.value || "").trim().toLowerCase(),
    type: ($("filterType")?.value || "").trim().toLowerCase(),
    brand: ($("filterBrand")?.value || "").toLowerCase(),
    min: Number($("priceMin")?.value || 0),
    max: Number($("priceMax")?.value || 0),
    state: $("filterState")?.value || "",
    yearMin: Number($("yearMin")?.value || 0),
    yearMax: Number($("yearMax")?.value || 0),
    color: ($("filterColor")?.value || "").trim().toLowerCase(),
    doc: $("filterDocument")?.value || "",
    license: ($("filterLicenseState")?.value || "").trim().toLowerCase()
  };
}

function filteredCars() {
  const filters = currentFilters();
  return cars.filter(car => {
    const haystack = [
      car.brand, car.model, car.year, car.state, car.type, car.color,
      car.document, car.licenseState, car.extra, car.id
    ].join(" ").toLowerCase();
    return (!filters.q || haystack.includes(filters.q)) &&
      (!filters.type || String(car.type || "").toLowerCase().includes(filters.type)) &&
      (!filters.brand || String(car.brand || "").toLowerCase() === filters.brand) &&
      (!filters.min || Number(car.price) >= filters.min) &&
      (!filters.max || Number(car.price) <= filters.max) &&
      (!filters.state || car.state === filters.state) &&
      (!filters.yearMin || Number(car.year) >= filters.yearMin) &&
      (!filters.yearMax || Number(car.year) <= filters.yearMax) &&
      (!filters.color || String(car.color || "").toLowerCase().includes(filters.color)) &&
      (!filters.doc || car.document === filters.doc) &&
      (!filters.license || String(car.licenseState || "").toLowerCase().includes(filters.license));
  });
}

function render() {
  const list = filteredCars();
  $("count").textContent = list.length + " سيارة";
  $("empty").hidden = list.length > 0;

  $("cars").innerHTML = list.map(car => {
    const title = [car.brand, car.model, car.year].filter(Boolean).join(" ");
    const imageUrls = [...new Set((Array.isArray(car.imageUrls) ? car.imageUrls : []).concat(car.image || []).map(safeHttpUrl).filter(Boolean))];
    const videoUrl = safeHttpUrl(car.video);
    const photo = imageUrls.length
      ? '<div class="car-gallery" aria-label="صور السيارة">' + imageUrls.map((url, index) =>
          '<img class="car-photo" loading="lazy" src="' + esc(url) + '" alt="' + esc(title + ' - صورة ' + (index + 1)) + '" onerror="this.style.display=\'none\'">'
        ).join('') + '</div>'
      : '<div class="photo-placeholder" role="img" aria-label="لا توجد صورة">🚘</div>';
    const phone = whatsappNumber(car.phone);
    const contact = phone
      ? '<a class="action call" href="tel:' + esc(phone) + '">☎ اتصال</a>' +
        '<a class="action whatsapp" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + esc(phone) +
        '?text=' + encodeURIComponent("السلام عليكم، أنا مهتم بالسيارة " + title + "، رقم العرض " + car.id + ". هل ما زالت متاحة؟") + '">◉ واتساب</a>'
      : '<button class="action" data-action="contact">☎ بيانات التواصل</button><button class="action" data-action="contact">◉ واتساب</button>';

    return '<article id="car-' + esc(car.id) + '" class="post">' +
      '<div class="post-head"><div class="avatar">م</div><div><strong>الملهلب</strong><small>عرض ' +
      esc(car.id) + ' · ' + esc(car.state) + '</small></div>' +
      (car.sold ? '<span class="sold-tag">تم البيع</span>' : '') + '</div>' +
      photo + '<div class="car-body"><h3 class="car-title">' + esc(title) + '</h3>' +
      '<p class="price">' + money(car.price) + ' <small>• قابل للتفاوض حسب الاتفاق</small></p>' +
      '<div class="meta"><span>📍 ' + esc(car.state) + '</span><span>📄 ' + esc(car.document || "غير محدد") +
      '</span><span>🎨 ' + esc(car.color || "غير محدد") + '</span><span>⚙ ' + esc(car.transmission || "غير محدد") +
      '</span><span>⛽ ' + esc(car.fuel || "غير محدد") + '</span><span>📋 ترخيص: ' +
      esc(car.licenseState || "غير محدد") + '</span></div><p class="desc">' + esc(description(car)) + '</p>' +
      (videoUrl ? '<p><a target="_blank" rel="noopener noreferrer" href="' + esc(videoUrl) + '">▶ مشاهدة الفيديو</a></p>' : '') +
      '<div class="offer-number">رقم العرض: ' + esc(car.id) + '</div><div class="actions">' + contact +
      '<button class="action" data-action="share" data-id="' + esc(car.id) + '">↗ مشاركة</button></div></div>' +
      (isAdmin() ? '<div class="admin-actions"><button data-action="edit" data-id="' + esc(car.id) +
        '">تعديل</button><button data-action="sold" data-id="' + esc(car.id) + '">' +
        (car.sold ? "إلغاء حالة البيع" : "تحديد تم البيع") +
        '</button><button data-action="delete" data-id="' + esc(car.id) + '">حذف</button></div>' : '') +
      '</article>';
  }).join("");
}

function updateAuthUI() {
  $("loginBtn").textContent = currentUser ? "خروج" : "دخول / حساب";
  updateNotifyUI();
  // إظهار إضافة السيارات للمدير فقط، وإخفاؤها أثناء عدم تسجيل الدخول أو لحساب المستخدم العادي.
  $("sellBtn").hidden = !isAdmin();
  $("sellBtn").textContent = "＋ أضف إعلان سيارة";
  if (isAdmin()) {
    setStatus("متصل بقاعدة Supabase. دخلت بحساب المدير، ويمكنك إضافة الإعلانات وتعديلها وحذفها.");
  } else if (currentUser) {
    setStatus("");
  }
}

function alertStorageKey() {
  return currentUser ? "almalhalab-car-alerts:" + currentUser.id : "";
}

function readAlertPreferences() {
  const key = alertStorageKey();
  if (!key) return null;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function updateNotifyUI() {
  const button = $("notifyBtn");
  const status = $("notifyStatus");
  if (!button || !status) return;
  const enabled = Boolean(currentUser && readAlertPreferences() && "Notification" in window && Notification.permission === "granted");
  button.textContent = enabled ? "✓ الإشعارات مفعّلة" : currentUser ? "فعّل إشعارات توفر السيارات" : "سجّل دخول وفعّل الإشعارات";
  status.textContent = enabled
    ? "تم حفظ خيارات بحثك. سننبهك عند ظهور عرض جديد مطابق ما دام الموقع مفتوحاً."
    : "حدّد مواصفات السيارة التي تبحث عنها من الفلاتر، ثم سجّل الدخول وفعّل الإشعارات.";
}

function matchesAlertPreferences(car, filters) {
  if (!car || car.sold || !car.published) return false;
  const f = filters || {};
  const haystack = [
    car.brand, car.model, car.year, car.state, car.type, car.color,
    car.document, car.licenseState, car.extra, car.id
  ].join(" ").toLowerCase();
  return (!f.q || haystack.includes(String(f.q).toLowerCase())) &&
    (!f.type || String(car.type || "").toLowerCase().includes(String(f.type).toLowerCase())) &&
    (!f.brand || String(car.brand || "").toLowerCase() === String(f.brand).toLowerCase()) &&
    (!f.min || Number(car.price) >= Number(f.min)) &&
    (!f.max || Number(car.price) <= Number(f.max)) &&
    (!f.state || car.state === f.state) &&
    (!f.yearMin || Number(car.year) >= Number(f.yearMin)) &&
    (!f.yearMax || Number(car.year) <= Number(f.yearMax)) &&
    (!f.color || String(car.color || "").toLowerCase().includes(String(f.color).toLowerCase())) &&
    (!f.doc || car.document === f.doc) &&
    (!f.license || String(car.licenseState || "").toLowerCase().includes(String(f.license).toLowerCase()));
}

function notifyForAvailableCar(car, filters) {
  if (!currentUser || !matchesAlertPreferences(car, filters)) return;
  const id = String(car.recordId || car.id || "");
  if (!id || alertedCarIds.has(id)) return;
  alertedCarIds.add(id);

  if ("Notification" in window && Notification.permission === "granted") {
    const title = [car.brand, car.model, car.year].filter(Boolean).join(" ");
    try {
      const notification = new Notification("الملهلب — لقينا عرض ممكن يناسبك 🚘", {
        body: title + "\n" + money(car.price) + " · " + (car.state || "السودان"),
        tag: "almalhalab-" + id,
        renotify: false
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        void refreshCars().finally(() => {
          setTimeout(() => {
            const cardId = String(car.id || "").replace(/[^a-zA-Z0-9_-]/g, "");
            const card = $("car-" + cardId);
            (card || $("cars"))?.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 250);
        });
      };
    } catch (error) {
      console.warn("Browser notification could not be shown:", error);
    }
  }
}

function stopCarAlerts() {
  if (carAlertChannel && db) {
    void db.removeChannel(carAlertChannel);
    carAlertChannel = null;
  }
  if (carAlertPollTimer) {
    clearInterval(carAlertPollTimer);
    carAlertPollTimer = null;
  }
}

function startCarAlerts(filters) {
  if (!db || !currentUser || !filters || !("Notification" in window) || Notification.permission !== "granted") return;
  stopCarAlerts();
  alertedCarIds = new Set(cars.map(car => String(car.recordId || car.id)));
  latestAlertCreatedAt = cars.reduce((latest, car) => {
    const time = car.createdAt ? new Date(car.createdAt).getTime() : 0;
    return time > latest ? time : latest;
  }, 0);
  latestAlertCreatedAt = latestAlertCreatedAt ? new Date(latestAlertCreatedAt).toISOString() : "1970-01-01T00:00:00.000Z";

  // Realtime gives fast alerts where the cars table is enabled for Supabase Realtime.
  carAlertChannel = db.channel("almalhalab-car-alerts-" + currentUser.id)
    .on("postgres_changes", { event: "*", schema: "public", table: "cars" }, payload => {
      const row = payload && payload.new;
      if (!row || !row.id) return;
      const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
      if (createdAt > new Date(latestAlertCreatedAt).getTime()) latestAlertCreatedAt = new Date(createdAt).toISOString();
      if (row.is_published && !row.is_sold) {
        notifyForAvailableCar(mapDatabaseCar(row), filters);
        void refreshCars();
      }
    })
    .subscribe();

  // Fallback when Realtime is unavailable; runs only while the page is open.
  carAlertPollTimer = setInterval(async () => {
    if (document.hidden || !db || !currentUser) return;
    const { data, error } = await db.from("cars")
      .select("*")
      .gt("created_at", latestAlertCreatedAt)
      .order("created_at", { ascending: true });
    if (error || !Array.isArray(data) || !data.length) return;
    for (const row of data) {
      const time = row.created_at ? new Date(row.created_at).getTime() : 0;
      if (time > new Date(latestAlertCreatedAt).getTime()) latestAlertCreatedAt = new Date(time).toISOString();
      if (row.is_published && !row.is_sold) notifyForAvailableCar(mapDatabaseCar(row), filters);
    }
    void refreshCars();
  }, 60000);

  updateNotifyUI();
}

async function enableCarAlerts() {
  if (!db) {
    toast("أكمل إعداد Supabase أولاً حتى نقدر نحفظ حسابك وخيارات البحث.");
    return;
  }
  if (!currentUser) {
    showAuthDialog();
    toast("سجّل الدخول أو أنشئ حساباً، وبعدها اضغط زر الإشعارات مرة ثانية.");
    return;
  }
  if (!("Notification" in window)) {
    toast("المتصفح لا يدعم الإشعارات. جرّب فتح الموقع في Chrome أو أضفه للشاشة الرئيسية.");
    return;
  }

  let permission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = "denied";
    }
  }
  if (permission !== "granted") {
    toast("لم يتم السماح بالإشعارات. فعّلها من إعدادات الموقع في المتصفح ثم حاول مرة أخرى.");
    updateNotifyUI();
    return;
  }

  const preferences = currentFilters();
  try {
    localStorage.setItem(alertStorageKey(), JSON.stringify(preferences));
  } catch {
    toast("تعذر حفظ خيارات البحث على هذا الجهاز.");
    return;
  }
  startCarAlerts(preferences);
  toast("تم تفعيل التنبيهات للعروض الجديدة المطابقة لبحثك.");
}

async function restoreCarAlerts() {
  const preferences = readAlertPreferences();
  if (preferences && "Notification" in window && Notification.permission === "granted") {
    startCarAlerts(preferences);
  } else {
    stopCarAlerts();
  }
  updateNotifyUI();
}

async function loadProfile() {
  currentProfile = null;
  userRole = "user";
  if (!db || !currentUser) return;

  const { data, error } = await db
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.warn("Profile lookup failed:", error.message);
    return;
  }

  currentProfile = data || null;
  userRole = data && data.role === "admin" ? "admin" : "user";
}

async function refreshCars() {
  if (!db) {
    cars = [];
    render();
    return;
  }

  const { data, error } = await db
    .from("cars")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    cars = [];
    render();
    setStatus("تعذر قراءة جدول السيارات. تأكد من تشغيل ملف supabase-schema.sql في SQL Editor ومن إعداد المفتاح العام في supabase-config.js. التفاصيل: " + error.message);
    return;
  }

  cars = (data || []).map(mapDatabaseCar);
  render();

  if (cars.length === 0) {
    setStatus("الاتصال بقاعدة البيانات يعمل، لكن لا توجد إعلانات منشورة بعد. أضف حساب المدير واتبع تعليمات README.md.");
  } else {
    setStatus("متصل بقاعدة Supabase وتُعرض الإعلانات المشتركة للجميع.");
  }
  updateAuthUI();
}

async function applySession(session) {
  currentUser = session && session.user ? session.user : null;
  await loadProfile();
  updateAuthUI();
  await refreshCars();
  render();
  await restoreCarAlerts();
}

function showAuthDialog() {
  authMode = "signin";
  updateAuthMode();
  authDialog.showModal();
}

function updateAuthMode() {
  const signingUp = authMode === "signup";
  $("authTitle").textContent = signingUp ? "إنشاء حساب مستخدم" : "دخول الحساب";
  $("authSubmit").textContent = signingUp ? "إنشاء الحساب" : "دخول";
  $("authToggleBtn").textContent = signingUp ? "لدي حساب بالفعل — دخول" : "إنشاء حساب جديد";
  $("authHint").textContent = signingUp
    ? "أنشئ حساباً عادياً باستخدام بريدك الإلكتروني وكلمة مرور من 8 أحرف على الأقل."
    : "دخول آمن عبر Supabase. صلاحيات المدير تُحدد من قاعدة البيانات، وليست من هذا الجهاز.";
  $("authPassword").minLength = 8;
}

function openCar(car) {
  if (!db) {
    toast("يجب إكمال إعداد مفتاح Supabase العام أولاً.");
    return;
  }
  if (!currentUser) {
    showAuthDialog();
    toast("سجّل الدخول أولاً. إضافة الإعلانات متاحة لحساب المدير.");
    return;
  }
  if (!isAdmin()) {
    toast("حسابك مستخدم عادي. تواصل مع مدير الملهلب لنشر إعلان.");
    return;
  }

  editingId = car ? car.id : null;
  carForm.reset();
  $("formTitle").textContent = car ? "تعديل " + car.id : "إضافة سيارة";
  $("imageFiles").value = "";
  if (car) {
    const values = {
      brand: car.brand, model: car.model, year: car.year, price: car.price,
      state: car.state, type: car.type, color: car.color,
      transmission: car.transmission, fuel: car.fuel, document: car.document,
      licenseState: car.licenseState, phone: car.phone, image: car.image,
      video: car.video, extra: car.extra, sold: car.sold
    };
    for (const [name, value] of Object.entries(values)) {
      const element = carForm.elements.namedItem(name);
      if (!element) continue;
      if (element.type === "checkbox") element.checked = Boolean(value);
      else element.value = value ?? "";
    }
  }
  carDialog.showModal();
}

async function uploadImage(file, offerNumber) {
  if (!file) return null;
  if (!file.type || !file.type.startsWith("image/")) throw new Error("الملف المختار ليس صورة.");
  if (file.size > 8 * 1024 * 1024) throw new Error("حجم الصورة أكبر من 8 ميغابايت. اختر صورة أصغر.");

  const safeName = String(file.name || "car-image").replace(/[^a-zA-Z0-9._-]/g, "-").slice(-90);
  const path = currentUser.id + "/" + offerNumber + "-" + Date.now() + "-" + safeName;
  const { error } = await db.storage.from("car-images").upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;

  const { data } = db.storage.from("car-images").getPublicUrl(path);
  return data.publicUrl;
}

async function saveCar(event) {
  event.preventDefault();
  if (!db || !currentUser || !isAdmin()) {
    toast("يلزم حساب مدير صالح لحفظ الإعلانات.");
    return;
  }

  const formData = new FormData(carForm);
  const values = Object.fromEntries(formData.entries());
  values.year = Number(values.year);
  values.price = Number(values.price);
  values.sold = formData.has("sold");

  const existing = editingId ? cars.find(car => car.id === editingId) : null;
  const offerNumber = editingId || "MLH-" + String(Date.now()).slice(-8);
  let images = existing && Array.isArray(existing.imageUrls) ? [...existing.imageUrls] : [];
  const typedImageUrl = safeHttpUrl(values.image);
  const files = $("imageFiles").files ? Array.from($("imageFiles").files) : [];

  try {
    $("carForm").querySelector('button[type="submit"]').disabled = true;
    const uploadedUrls = [];
    for (const file of files) uploadedUrls.push(await uploadImage(file, offerNumber));
    if (uploadedUrls.length) images = [...uploadedUrls, ...images.filter(url => !uploadedUrls.includes(url))];
    if (typedImageUrl) images = [typedImageUrl, ...images.filter(url => url !== typedImageUrl)];

    const record = {
      offer_number: offerNumber,
      brand: String(values.brand || "").trim(),
      model: String(values.model || "").trim(),
      year: values.year,
      price_sdg: values.price,
      state: values.state,
      car_type: String(values.type || "").trim() || null,
      color: String(values.color || "").trim() || null,
      transmission: values.transmission || null,
      fuel: values.fuel || null,
      document_type: values.document || null,
      license_state: String(values.licenseState || "").trim() || null,
      phone: String(values.phone || "").trim(),
      image_urls: images,
      video_url: safeHttpUrl(values.video) || null,
      extra_description: String(values.extra || "").trim() || null,
      is_sold: values.sold,
      is_published: true,
      updated_at: new Date().toISOString()
    };

    let result;
    if (existing) {
      result = await db.from("cars").update(record).eq("id", existing.recordId);
    } else {
      record.owner_id = currentUser.id;
      result = await db.from("cars").insert(record);
    }
    if (result.error) throw result.error;

    carDialog.close();
    await refreshCars();
    toast(existing ? "تم تحديث الإعلان في قاعدة البيانات." : "تم حفظ الإعلان في قاعدة البيانات.");
  } catch (error) {
    console.error("Saving car failed:", error);
    toast("تعذر حفظ الإعلان: " + (error.message || "خطأ غير معروف"));
  } finally {
    const submitButton = $("carForm").querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = false;
  }
}

async function signInWithGoogle() {
  if (!db) {
    toast("أكمل إعداد Supabase أولاً.");
    return;
  }
  const button = $("googleSignInBtn");
  button.disabled = true;
  try {
    const { error } = await db.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
    if (error) throw error;
  } catch (error) {
    console.error("Google sign-in failed:", error);
    toast("تعذر تسجيل الدخول عبر Google: " + (error.message || "حاول مرة أخرى."));
    button.disabled = false;
  }
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  if (!db) {
    toast("أضف المفتاح العام في supabase-config.js أولاً.");
    return;
  }

  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  $("authSubmit").disabled = true;

  try {
    let result;
    if (authMode === "signup") {
      result = await db.auth.signUp({
        email,
        password,
        options: { data: { display_name: email.split("@")[0] } }
      });
      if (result.error) throw result.error;
      if (!result.data.session) {
        authDialog.close();
        toast("تم إنشاء الحساب. افحص بريدك الإلكتروني لتأكيده، ثم سجّل الدخول.");
      } else {
        authDialog.close();
        await applySession(result.data.session);
        toast("تم إنشاء الحساب وتسجيل الدخول.");
      }
    } else {
      result = await db.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      authDialog.close();
      await applySession(result.data.session);
      toast(isAdmin() ? "مرحباً بك، تم التحقق من صلاحيات المدير." : "تم تسجيل الدخول بنجاح.");
    }
  } catch (error) {
    console.error("Authentication failed:", error);
    toast("تعذر إكمال العملية: " + (error.message || "تحقق من البريد وكلمة المرور."));
  } finally {
    $("authSubmit").disabled = false;
  }
}

async function toggleSold(car) {
  if (!db || !isAdmin() || !car) return;
  const { error } = await db.from("cars")
    .update({ is_sold: !car.sold, updated_at: new Date().toISOString() })
    .eq("id", car.recordId);
  if (error) {
    toast("تعذر تغيير حالة البيع: " + error.message);
    return;
  }
  await refreshCars();
  toast(car.sold ? "تم إلغاء حالة البيع." : "تم تحديد السيارة كـ«تم البيع».");
}

async function deleteCar(car) {
  if (!db || !isAdmin() || !car) return;
  if (!confirm("هل تريد حذف العرض " + car.id + " من قاعدة البيانات المشتركة؟")) return;
  const { error } = await db.from("cars").delete().eq("id", car.recordId);
  if (error) {
    toast("تعذر حذف الإعلان: " + error.message);
    return;
  }
  await refreshCars();
  toast("تم حذف الإعلان من قاعدة البيانات.");
}

$("search").addEventListener("input", render);
$("filters").addEventListener("submit", event => { event.preventDefault(); render(); });
$("filters").addEventListener("reset", () => setTimeout(render, 0));
$("resetFilters").addEventListener("click", () => { $("search").value = ""; });

$("themeBtn").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "" : "dark";
  if (next) document.documentElement.dataset.theme = next;
  else delete document.documentElement.dataset.theme;
  try { localStorage.setItem(STORAGE_THEME_KEY, next); } catch {}
});

try {
  const theme = localStorage.getItem(STORAGE_THEME_KEY);
  if (theme === "dark") document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
} catch {}

$("loginBtn").addEventListener("click", async () => {
  if (!db) {
    toast("أكمل إعداد Supabase أولاً: المفتاح العام في supabase-config.js.");
    return;
  }
  if (currentUser) {
    stopCarAlerts();
    try { localStorage.removeItem(alertStorageKey()); } catch {}
    const { error } = await db.auth.signOut();
    if (error) toast("تعذر تسجيل الخروج: " + error.message);
    else {
      await applySession(null);
      toast("تم تسجيل الخروج.");
    }
  } else {
    showAuthDialog();
  }
});

$("sellBtn").addEventListener("click", () => openCar(null));
$("notifyBtn").addEventListener("click", () => { void enableCarAlerts(); });
$("closeAuthDialog").addEventListener("click", () => authDialog.close());
$("authToggleBtn").addEventListener("click", () => {
  authMode = authMode === "signin" ? "signup" : "signin";
  updateAuthMode();
});
$("authForm").addEventListener("submit", handleAuthSubmit);
$("googleSignInBtn").addEventListener("click", signInWithGoogle);
$("closeCarDialog").addEventListener("click", () => carDialog.close());
$("cancelCar").addEventListener("click", () => carDialog.close());
carForm.addEventListener("submit", saveCar);

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const car = cars.find(item => item.id === button.dataset.id);

  switch (button.dataset.action) {
    case "contact":
      toast("هذا الإعلان لا يحتوي على رقم تواصل. تواصل مع إدارة الملهلب.");
      break;
    case "edit":
      if (isAdmin()) openCar(car);
      break;
    case "sold":
      await toggleSold(car);
      break;
    case "delete":
      await deleteCar(car);
      break;
    case "share":
      if (car) {
        const shareText = "الملهلب — " + car.brand + " " + car.model + " " + car.year +
          "\nالسعر: " + money(car.price) + "\nالولاية: " + car.state + "\nرقم العرض: " + car.id;
        try {
          if (navigator.share) await navigator.share({ title: "عرض " + car.id, text: shareText, url: location.href });
          else if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareText);
            toast("تم نسخ تفاصيل الإعلان.");
          } else {
            toast(shareText);
          }
        } catch (error) {
          if (error && error.name !== "AbortError") toast("تعذرت مشاركة الإعلان.");
        }
      }
      break;
  }
});

$("yearNow").textContent = new Date().getFullYear();

if (!db) {
  setStatus("الموقع جاهز للربط، لكن المفتاح العام لـ Supabase لم يُضف بعد. اتبع خطوات README.md. لا تُدخل أي مفتاح service_role هنا.");
  render();
} else {
  setStatus("جاري الاتصال بقاعدة البيانات المشتركة…");
  db.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => { void applySession(session); }, 0);
  });
  db.auth.getSession().then(({ data, error }) => {
    if (error) {
      setStatus("تعذر التحقق من الجلسة: " + error.message);
      return;
    }
    void applySession(data.session);
  }).catch(error => {
    setStatus("تعذر الاتصال بـ Supabase: " + error.message);
  });
}

