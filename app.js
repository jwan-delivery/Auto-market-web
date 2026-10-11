const cars=[
  {id:1,title:"Toyota Camry 2022",price:"32,000,000 جنيه",city:"الخرطوم",details:"أوتوماتيك · بنزين · حالة ممتازة",description:"سيارة نظيفة وجاهزة للمعاينة. التواصل مع البائع لمعرفة التفاصيل.",image:""},
  {id:2,title:"Hyundai Elantra 2021",price:"25,500,000 جنيه",city:"أم درمان",details:"أوتوماتيك · بنزين · استخدام شخصي",description:"عرض جديد. المعاينة متاحة بالاتفاق مع البائع.",image:""},
  {id:3,title:"Kia Sportage 2023",price:"38,000,000 جنيه",city:"بحري",details:"أوتوماتيك · بنزين · فئة عالية",description:"سيارة عائلية مميزة، مع صور وتفاصيل إضافية عند التواصل.",image:""}
];

const carsEl=document.getElementById("cars");
const searchEl=document.getElementById("search");
const countEl=document.getElementById("count");
const emptyEl=document.getElementById("empty");

function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));}

function render(list){
  countEl.textContent=list.length+" سيارة";
  emptyEl.hidden=list.length!==0;
  carsEl.innerHTML=list.map(car=>`
    <article class="post">
      <div class="post-head">
        <div class="avatar">🚗</div>
        <div><strong>Auto Market</strong><small>عرض سيارة · ${escapeHtml(car.city)}</small></div>
      </div>
      ${car.image?'<img class="car-photo" src="'+escapeHtml(car.image)+'" alt="'+escapeHtml(car.title)+'">':'<div class="photo-placeholder" role="img" aria-label="صورة سيارة">🚘</div>'}
      <div class="car-body">
        <h3 class="car-title">${escapeHtml(car.title)}</h3>
        <p class="price">${escapeHtml(car.price)}</p>
        <p class="meta">📍 ${escapeHtml(car.city)} · ${escapeHtml(car.details)}</p>
        <p class="desc">${escapeHtml(car.description)}</p>
        <div class="actions">
          <button class="action" data-action="call">📞 اتصال</button>
          <button class="action" data-action="whatsapp">💬 واتساب</button>
          <button class="action" data-action="share" data-id="${car.id}">↗ مشاركة</button>
        </div>
      </div>
    </article>`).join("");
}

searchEl.addEventListener("input",e=>{
  const q=e.target.value.trim().toLowerCase();
  render(cars.filter(c=>[c.title,c.price,c.city,c.details,c.description].join(" ").toLowerCase().includes(q)));
});

document.addEventListener("click",async e=>{
  const btn=e.target.closest(".action");
  if(btn){
    if(btn.dataset.action==="share"){
      const car=cars.find(c=>c.id===Number(btn.dataset.id));
      const text=car.title+" - "+car.price+" - "+car.city;
      if(navigator.share){try{await navigator.share({title:car.title,text,url:location.href})}catch{}}
      else showToast("انسخ رابط الموقع وشاركه مع المشتري");
    }else{
      showToast("رقم التواصل سيُضاف من لوحة الإدارة");
    }
  }
  if(e.target.id==="sellBtn") showToast("سيتم فتح نموذج إضافة السيارة في لوحة الإدارة قريباً");
  if(e.target.id==="loginBtn") showToast("تسجيل الدخول سيُربط بالحسابات في المرحلة التالية");
});

function showToast(message){
  const old=document.querySelector(".toast");if(old)old.remove();
  const t=document.createElement("div");t.className="toast";t.textContent=message;document.body.appendChild(t);
  setTimeout(()=>t.remove(),2600);
}
render(cars);
