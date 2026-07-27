const express=require('express');
const session=require('express-session');
const bcrypt=require('bcryptjs');
const multer=require('multer');
const path=require('path');
const fs=require('fs');
const {Pool}=require('pg');

const app=express();
const PORT=process.env.PORT||3000;

const uploadDir=path.join(__dirname,'public','uploads');
fs.mkdirSync(uploadDir,{recursive:true});

const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:{rejectUnauthorized:false}
});

app.use(express.json({limit:'10mb'}));
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret:process.env.SESSION_SECRET||'change-this-secret',
  resave:false,
  saveUninitialized:false,
  cookie:{
    httpOnly:true,
    maxAge:604800000
  }
}));

app.use(express.static(path.join(__dirname,'public')));

const upload=multer({dest:uploadDir});

const auth=(req,res,next)=>
  req.session.user
    ? next()
    : res.status(401).json({error:'লগইন প্রয়োজন'});

const adminOnly=(req,res,next)=>
  req.session.user?.role==='admin'
    ? next()
    : res.status(403).json({error:'Admin access required'});

async function initDatabase(){

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'advertiser',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS categories(
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news(
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT,
      excerpt TEXT,
      content TEXT,
      image TEXT,
      category_id INTEGER,
      author TEXT,
      views INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS comments(
      id SERIAL PRIMARY KEY,
      news_id INTEGER,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS ads(
      id SERIAL PRIMARY KEY,
      advertiser_id INTEGER,
      title TEXT,
      image TEXT,
      link TEXT,
      package TEXT,
      payment_method TEXT,
      payment_reference TEXT,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const adminEmail=
    process.env.ADMIN_EMAIL||
    'admin@ghotonarpichone.com';

  const adminPassword=
    process.env.ADMIN_PASSWORD||
    'Admin@12345';

  const existing=
    await pool.query(
      'SELECT id FROM users WHERE email=$1',
      [adminEmail]
    );

  if(!existing.rows.length){

    const hashed=
      await bcrypt.hash(adminPassword,10);

    await pool.query(
      `INSERT INTO users
       (name,email,password,role)
       VALUES($1,$2,$3,'admin')`,
      [
        'Super Admin',
        adminEmail,
        hashed
      ]
    );
  }

  const categoryNames=[
    'জাতীয়',
    'রাজনীতি',
    'আন্তর্জাতিক',
    'খেলাধুলা',
    'বিনোদন',
    'প্রযুক্তি',
    'অপরাধ',
    'মতামত'
  ];

  for(const name of categoryNames){

    await pool.query(
      `INSERT INTO categories(name)
       VALUES($1)
       ON CONFLICT(name) DO NOTHING`,
      [name]
    );
  }

  const newsCount=
    await pool.query(
      'SELECT COUNT(*)::int AS count FROM news'
    );

  if(newsCount.rows[0].count===0){

    const category=
      await pool.query(
        `SELECT id
         FROM categories
         WHERE name='জাতীয়'
         LIMIT 1`
      );

    await pool.query(
      `INSERT INTO news
       (title,slug,excerpt,content,image,category_id,author,views,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,0,'published')`,
      [
        'ঘটনার পিছনে — সত্যের সন্ধানে আপনার নির্ভরযোগ্য সংবাদমাধ্যম',
        'launch-'+Date.now(),
        'সংবাদ, বিশ্লেষণ ও সত্যের অনুসন্ধান।',
        'এটি আপনার নিউজ পোর্টালের প্রথম সংবাদ। Admin Panel থেকে এটি পরিবর্তন বা নতুন সংবাদ প্রকাশ করতে পারবেন।',
        null,
        category.rows[0]?.id||null,
        'ঘটনার পিছনে'
      ]
    );
  }

  console.log('PostgreSQL database ready');
}

app.get('/api/me',(req,res)=>
  res.json({
    user:req.session.user||null
  })
);

app.post('/api/auth/register',async(req,res)=>{

  try{

    const{
      name,
      email,
      password
    }=req.body;

    if(!name||!email||!password)
      return res.status(400).json({
        error:'সব তথ্য দিন'
      });

    const exists=
      await pool.query(
        'SELECT id FROM users WHERE email=$1',
        [email]
      );

    if(exists.rows.length)
      return res.status(400).json({
        error:'এই ইমেইল আগে থেকেই ব্যবহার হয়েছে'
      });

    const hashed=
      await bcrypt.hash(password,10);

    const result=
      await pool.query(
        `INSERT INTO users
         (name,email,password,role)
         VALUES($1,$2,$3,'advertiser')
         RETURNING id,name,email,role`,
        [
          name,
          email,
          hashed
        ]
      );

    const u=result.rows[0];

    req.session.user=u;

    res.json({
      ok:true,
      user:u
    });

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:'Registration failed'
    });

  }

});

app.post('/api/auth/login',async(req,res)=>{

  try{

    const{
      email,
      password
    }=req.body;

    const result=
      await pool.query(
        'SELECT * FROM users WHERE email=$1',
        [email]
      );

    const u=result.rows[0];

    if(
      !u||
      !(await bcrypt.compare(password,u.password))
    )
      return res.status(401).json({
        error:'ইমেইল বা পাসওয়ার্ড ভুল'
      });

    req.session.user={
      id:u.id,
      name:u.name,
      email:u.email,
      role:u.role
    };

    res.json({
      ok:true,
      user:req.session.user
    });

  }catch(err){

    console.error(err);

    res.status(500).json({
      error:'Login failed'
    });

  }

});

app.post('/api/auth/logout',(req,res)=>
  req.session.destroy(()=>
    res.json({ok:true})
  )
);

app.get('/api/categories',async(req,res)=>{

  const result=
    await pool.query(
      `SELECT *
       FROM categories
       ORDER BY name`
    );

  res.json(result.rows);

});

app.get('/api/news',async(req,res)=>{

  const q=
    String(req.query.q||'').toLowerCase();

  const result=
    await pool.query(
      `SELECT
        n.*,
        c.name AS category
       FROM news n
       LEFT JOIN categories c
       ON c.id=n.category_id
       WHERE n.status='published'
       ORDER BY n.created_at DESC`
    );

  const rows=
    result.rows.filter(n=>
      !q||
      String(n.title||'').toLowerCase().includes(q)||
      String(n.excerpt||'').toLowerCase().includes(q)||
      String(n.content||'').toLowerCase().includes(q)
    );

  res.json(rows);

});

app.get('/api/news/:id',async(req,res)=>{

  const result=
    await pool.query(
      `UPDATE news
       SET views=COALESCE(views,0)+1
       WHERE id=$1
       AND status='published'
       RETURNING *`,
      [
        Number(req.params.id)
      ]
    );

  const n=result.rows[0];

  if(!n)
    return res.status(404).json({
      error:'নিউজ পাওয়া যায়নি'
    });

  const category=
    await pool.query(
      `SELECT name
       FROM categories
       WHERE id=$1`,
      [n.category_id]
    );

  res.json({
    ...n,
    category:category.rows[0]?.name||null
  });

});

app.get('/api/news/:id/comments',async(req,res)=>{

  const result=
    await pool.query(
      `SELECT *
       FROM comments
       WHERE news_id=$1
       AND status='approved'
       ORDER BY id DESC`,
      [
        Number(req.params.id)
      ]
    );

  res.json(result.rows);

});

app.post('/api/news/:id/comments',async(req,res)=>{

  const{
    name,
    text
  }=req.body;

  if(!name||!text)
    return res.status(400).json({
      error:'নাম ও মন্তব্য লিখুন'
    });

  await pool.query(
    `INSERT INTO comments
     (news_id,name,text,status)
     VALUES($1,$2,$3,'pending')`,
    [
      Number(req.params.id),
      name,
      text
    ]
  );

  res.json({
    ok:true,
    message:'মন্তব্য অনুমোদনের জন্য পাঠানো হয়েছে'
  });

});

app.post('/api/ads',auth,upload.single('image'),async(req,res)=>{

  if(req.session.user.role!=='advertiser')
    return res.status(403).json({
      error:'Advertiser account required'
    });

  const{
    title,
    link,
    package:pkg,
    payment_method,
    payment_reference
  }=req.body;

  await pool.query(
    `INSERT INTO ads
     (
       advertiser_id,
       title,
       image,
       link,
       package,
       payment_method,
       payment_reference,
       status
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,'pending')`,
    [
      req.session.user.id,
      title,
      req.file
        ? '/uploads/'+req.file.filename
        : null,
      link,
      pkg,
      payment_method,
      payment_reference
    ]
  );

  res.json({
    ok:true,
    message:'বিজ্ঞাপনের আবেদন জমা হয়েছে'
  });

});

app.get('/api/my-ads',auth,async(req,res)=>{

  const result=
    await pool.query(
      `SELECT *
       FROM ads
       WHERE advertiser_id=$1
       ORDER BY id DESC`,
      [
        req.session.user.id
      ]
    );

  res.json(result.rows);

});

app.get('/api/admin/stats',adminOnly,async(req,res)=>{

  const news=
    await pool.query(
      'SELECT COUNT(*)::int AS count FROM news'
    );

  const comments=
    await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM comments
       WHERE status='pending'`
    );

  const ads=
    await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM ads
       WHERE status='pending'`
    );

  const users=
    await pool.query(
      'SELECT COUNT(*)::int AS count FROM users'
    );

  res.json({
    news:news.rows[0].count,
    comments:comments.rows[0].count,
    ads:ads.rows[0].count,
    users:users.rows[0].count
  });

});

app.get('/api/admin/news',adminOnly,async(req,res)=>{

  const result=
    await pool.query(
      `SELECT
        n.*,
        c.name AS category
       FROM news n
       LEFT JOIN categories c
       ON c.id=n.category_id
       ORDER BY n.id DESC`
    );

  res.json(result.rows);

});

app.post('/api/admin/news',adminOnly,upload.single('image'),async(req,res)=>{

  const{
    title,
    excerpt,
    content,
    category_id
  }=req.body;

  await pool.query(
    `INSERT INTO news
     (
       title,
       slug,
       excerpt,
       content,
       image,
       category_id,
       author,
       views,
       status
     )
     VALUES($1,$2,$3,$4,$5,$6,$7,0,'published')`,
    [
      title,
      'news-'+Date.now(),
      excerpt,
      content,
      req.file
        ? '/uploads/'+req.file.filename
        : null,
      category_id
        ? Number(category_id)
        : null,
      'ঘটনার পিছনে'
    ]
  );

  res.json({
    ok:true
  });

});

app.delete('/api/admin/news/:id',adminOnly,async(req,res)=>{

  await pool.query(
    `DELETE FROM news
     WHERE id=$1`,
    [
      Number(req.params.id)
    ]
  );

  res.json({
    ok:true
  });

});

app.get('/api/admin/comments',adminOnly,async(req,res)=>{

  const result=
    await pool.query(`
      SELECT
        c.*,
        n.title AS news_title
      FROM comments c
      LEFT JOIN news n
      ON n.id=c.news_id
      ORDER BY c.id DESC
    `);

  res.json(result.rows);

});

app.patch('/api/admin/comments/:id',adminOnly,async(req,res)=>{

 
