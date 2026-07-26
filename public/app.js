const $=s=>document.querySelector(s);let currentTab='login';
async function api(url,opt={}){let r=await fetch(url,opt),d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d}
function renderAuth(tab='login'){currentTab=tab;$('#authForm').innerHTML=tab==='login'?'<input name="email" type="email" placeholder="ইমেইল" required><input name="password" type="password" placeholder="পাসওয়ার্ড" required><button>লগইন</button>':'<input name="name" placeholder="নাম" required><input name="email" type="email" placeholder="ইমেইল" required><input name="password" type="password" placeholder="পাসওয়ার্ড" required><button>অ্যাকাউন্ট তৈরি করুন</button>'}
async function loadNews(){let q=$('#search').value,data=await api('/api/news?q='+encodeURIComponent(q));$('#news').innerHTML=data.map(n=>`<article class="card">
${n.image ? `<img src="${n.image}" alt="${n.title}" style="width:100%;height:220px;object-fit:cover;border-radius:12px 12px 0 0;">` : ''}
<div class="pad">
<div class="meta">${n.category||'সংবাদ'} · ${new Date(n.created_at).toLocaleDateString('bn-BD')}</div>
<h3><a href="/news.html?id=${n.id}">${n.title}</a></h3>
<p>${n.excerpt||n.content.slice(0,150)}...</p>
<div class="meta">👁 ${n.views} views</div>
</div>
</article>`).join('')}
function openAuth(){ $('#modal').classList.remove('hidden'); renderAuth('login') }
$('#loginBtn').onclick=openAuth;$('#adBtn').onclick=async()=>{try{let m=await api('/api/me');if(m.user&&m.user.role==='advertiser')location.href='/advertiser.html';else openAuth()}catch(e){openAuth()}};
$('.close').onclick=()=>$('#modal').classList.add('hidden');document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>renderAuth(b.dataset.tab));
$('#authForm').onsubmit=async e=>{e.preventDefault();try{let d=await api('/api/auth/'+(currentTab==='login'?'login':'register'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});$('#modal').classList.add('hidden');if(d.user?.role==='advertiser')location.href='/advertiser.html'}catch(err){alert(err.message)}};
$('#theme').onclick=()=>{document.body.classList.toggle('dark');document.body.style.background=document.body.classList.contains('dark')?'#111':'#f5f6f8';document.body.style.color=document.body.classList.contains('dark')?'#eee':'#17202a'};$('#search').oninput=loadNews;loadNews();
