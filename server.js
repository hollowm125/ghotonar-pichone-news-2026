const express=require('express'),session=require('express-session'),bcrypt=require('bcryptjs'),multer=require('multer'),path=require('path'),fs=require('fs');
const app=express(),PORT=process.env.PORT||3000;
const dataDir=path.join(__dirname,'data'),dbFile=path.join(dataDir,'database.json');
const uploadDir=path.join(__dirname,'public','uploads');fs.mkdirSync(dataDir,{recursive:true});fs.mkdirSync(uploadDir,{recursive:true});
const blank=()=>({users:[],categories:[],news:[],comments:[],ads:[],seq:{users:1,categories:1,news:1,comments:1,ads:1}});
let db;
try{db=fs.existsSync(dbFile)?JSON.parse(fs.readFileSync(dbFile,'utf8')):blank()}catch(e){db=blank()}
for(const k of ['users','categories','news','comments','ads'])if(!Array.isArray(db[k]))db[k]=[];
if(!db.seq)db.seq={users:1,categories:1,news:1,comments:1,ads:1};
const save=()=>fs.writeFileSync(dbFile,JSON.stringify(db,null,2));
const next=k=>db.seq[k]++;
const now=()=>new Date().toISOString();
const appJson=express();
app.use(express.json({limit:'10mb'}));app.use(express.urlencoded({extended:true}));
app.use(session({secret:process.env.SESSION_SECRET||'change-this-secret',resave:false,saveUninitialized:false,cookie:{httpOnly:true,maxAge:604800000}}));
app.use(express.static(path.join(__dirname,'public')));
const upload=multer({dest:uploadDir});
const adminEmail=process.env.ADMIN_EMAIL||'admin@ghotonarpichone.com',adminPassword=process.env.ADMIN_PASSWORD||'Admin@12345';
if(!db.users.some(u=>u.email===adminEmail)){db.users.push({id:next('users'),name:'Super Admin',email:adminEmail,password:bcrypt.hashSync(adminPassword,10),role:'admin',created_at:now()});save()}
for(const name of ['জাতীয়','রাজনীতি','আন্তর্জাতিক','খেলাধুলা','বিনোদন','প্রযুক্তি','অপরাধ','মতামত'])if(!db.categories.some(c=>c.name===name))db.categories.push({id:next('categories'),name});
if(!db.news.length){const c=db.categories.find(c=>c.name==='জাতীয়');db.news.push({id:next('news'),title:'ঘটনার পিছনে — সত্যের সন্ধানে আপনার নির্ভরযোগ্য সংবাদমাধ্যম',slug:'launch-'+Date.now(),excerpt:'সংবাদ, বিশ্লেষণ ও সত্যের অনুসন্ধান।',content:'এটি আপনার নিউজ পোর্টালের প্রথম সংবাদ। Admin Panel থেকে এটি পরিবর্তন বা নতুন সংবাদ প্রকাশ করতে পারবেন।',image:null,category_id:c.id,author:'ঘটনার পিছনে',views:0,status:'published',created_at:now()});save()}
if(!db.users.some(u=>u.email==="admin@ghotonar.com")){db.users.push({id:next("users"),name:"Administrator",email:"admin@ghotonar.com",password:bcrypt.hashSync("admin123",10),role:"admin",created_at:now()});save();}
const auth=(req,res,next)=>req.session.user?next():res.status(401).json({error:'লগইন প্রয়োজন'}),adminOnly=(req,res,next)=>req.session.user?.role==='admin'?next():res.status(403).json({error:'Admin access required'});
app.get('/api/me',(req,res)=>res.json({user:req.session.user||null}));
app.post('/api/auth/register',(req,res)=>{const{name,email,password}=req.body;if(!name||!email||!password)return res.status(400).json({error:'সব তথ্য দিন'});if(db.users.some(u=>u.email===email))return res.status(400).json({error:'এই ইমেইল আগে থেকেই ব্যবহার হয়েছে'});const u={id:next('users'),name,email,password:bcrypt.hashSync(password,10),role:'advertiser',created_at:now()};db.users.push(u);save();req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};res.json({ok:true,user:req.session.user})});
app.post('/api/auth/login',(req,res)=>{const u=db.users.find(u=>u.email===req.body.email);if(!u||!bcrypt.compareSync(req.body.password,u.password))return res.status(401).json({error:'ইমেইল বা পাসওয়ার্ড ভুল'});req.session.user={id:u.id,name:u.name,email:u.email,role:u.role};res.json({ok:true,user:req.session.user})});
app.post('/api/auth/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/categories',(req,res)=>res.json([...db.categories].sort((a,b)=>a.name.localeCompare(b.name,'bn'))));
app.get('/api/news',(req,res)=>{const q=String(req.query.q||'').toLowerCase();res.json(db.news.filter(n=>n.status==='published'&&(!q||[n.title,n.excerpt,n.content].some(x=>String(x||'').toLowerCase().includes(q)))).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(n=>({...n,category:(db.categories.find(c=>c.id===n.category_id)||{}).name||null})))});
app.get('/api/news/:id',(req,res)=>{const n=db.news.find(n=>n.id===Number(req.params.id)&&n.status==='published');if(!n)return res.status(404).json({error:'নিউজ পাওয়া যায়নি'});n.views=(n.views||0)+1;save();res.json({...n,category:(db.categories.find(c=>c.id===n.category_id)||{}).name||null})});
app.get('/api/news/:id/comments',(req,res)=>res.json(db.comments.filter(c=>c.news_id===Number(req.params.id)&&c.status==='approved').sort((a,b)=>b.id-a.id)));
app.post('/api/news/:id/comments',(req,res)=>{const{name,text}=req.body;if(!name||!text)return res.status(400).json({error:'নাম ও মন্তব্য লিখুন'});db.comments.push({id:next('comments'),news_id:Number(req.params.id),name,text,status:'pending',created_at:now()});save();res.json({ok:true,message:'মন্তব্য অনুমোদনের জন্য পাঠানো হয়েছে'})});
app.post('/api/ads',auth,upload.single('image'),(req,res)=>{if(req.session.user.role!=='advertiser')return res.status(403).json({error:'Advertiser account required'});const{title,link,package:pkg,payment_method,payment_reference}=req.body;db.ads.push({id:next('ads'),advertiser_id:req.session.user.id,title,image:req.file?'/uploads/'+req.file.filename:null,link,package:pkg,payment_method,payment_reference,status:'pending',created_at:now()});save();res.json({ok:true,message:'বিজ্ঞাপনের আবেদন জমা হয়েছে'})});
app.get('/api/my-ads',auth,(req,res)=>res.json(db.ads.filter(a=>a.advertiser_id===req.session.user.id).sort((a,b)=>b.id-a.id)));
app.get('/api/admin/stats',adminOnly,(req,res)=>res.json({news:db.news.length,comments:db.comments.filter(c=>c.status==='pending').length,ads:db.ads.filter(a=>a.status==='pending').length,users:db.users.length}));
app.get('/api/admin/news',adminOnly,(req,res)=>res.json([...db.news].sort((a,b)=>b.id-a.id).map(n=>({...n,category:(db.categories.find(c=>c.id===n.category_id)||{}).name||null}))));
app.post('/api/admin/news',adminOnly,upload.single('image'),(req,res)=>{const{title,excerpt,content,category_id}=req.body;db.news.push({id:next('news'),title,slug:'news-'+Date.now(),excerpt,content,image:req.file?'/uploads/'+req.file.filename:null,category_id:category_id?Number(category_id):null,author:'ঘটনার পিছনে',views:0,status:'published',created_at:now()});save();res.json({ok:true})});
app.delete('/api/admin/news/:id',adminOnly,(req,res)=>{db.news=db.news.filter(n=>n.id!==Number(req.params.id));save();res.json({ok:true})});
app.get('/api/admin/comments',adminOnly,(req,res)=>res.json([...db.comments].sort((a,b)=>b.id-a.id).map(c=>({...c,news_title:(db.news.find(n=>n.id===c.news_id)||{}).title||''}))));
app.patch('/api/admin/comments/:id',adminOnly,(req,res)=>{const c=db.comments.find(c=>c.id===Number(req.params.id));if(c)c.status=req.body.status;save();res.json({ok:true})});
app.get('/api/admin/ads',adminOnly,(req,res)=>res.json([...db.ads].sort((a,b)=>b.id-a.id).map(a=>({...a,advertiser:(db.users.find(u=>u.id===a.advertiser_id)||{}).name||'',email:(db.users.find(u=>u.id===a.advertiser_id)||{}).email||''}))));
app.patch('/api/admin/ads/:id',adminOnly,(req,res)=>{const a=db.ads.find(a=>a.id===Number(req.params.id));if(a)a.status=req.body.status;save();res.json({ok:true})});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log('ঘটনার পিছনে চলছে: http://localhost:'+PORT));
