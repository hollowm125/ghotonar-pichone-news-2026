const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(express.json({limit:"10mb"}));
app.use(express.urlencoded({extended:true}));

app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave:false,
  saveUninitialized:false
}));

app.use(express.static(path.join(__dirname,"public")));

console.log("PostgreSQL backend started");
async function initDatabase(){
    try{

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'advertiser',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
          await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);
          await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        excerpt TEXT,
        content TEXT NOT NULL,
        image TEXT,
        category_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
          await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        news_id INTEGER,
        name TEXT,
        text TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
          await pool.query(`
      CREATE TABLE IF NOT EXISTS ads (
        id SERIAL PRIMARY KEY,
        advertiser TEXT,
        email TEXT,
title TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
      // Create default admin account if it doesn't exist
const adminEmail = "admin@ghotonarpichone.com";

const adminExists = await pool.query(
  "SELECT id FROM users WHERE email=$1",
  [adminEmail]
);

if (adminExists.rows.length === 0) {
  const adminPassword = bcrypt.hashSync("Admin@12345", 10);

  await pool.query(
    "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4)",
    [
      "Administrator",
      adminEmail,
      adminPassword,
      "admin"
    ]
  );

  console.log("Default admin account created");
}
          console.log("Database tables ready");

  }catch(error){

    console.error("Database setup error:", error.message);
    process.exit(1);

  }

}
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
app.get("/api/me",(req,res)=>{
  res.json({user:req.session.user||null});
});

app.post("/api/auth/register",async(req,res)=>{
  try{
    const {name,email,password}=req.body;

    if(!name||!email||!password)
      return res.status(400).json({error:"সব তথ্য দিন"});

    const exists=await pool.query(
      "SELECT id FROM users WHERE email=$1",
      [email]
    );

    if(exists.rows.length)
      return res.status(400).json({error:"ইমেইল আগে ব্যবহার হয়েছে"});

    const hash=bcrypt.hashSync(password,10);

    const result=await pool.query(
      "INSERT INTO users(name,email,password,role) VALUES($1,$2,$3,$4) RETURNING id,name,email,role",
      [name,email,hash,"advertiser"]
    );

    req.session.user=result.rows[0];

    res.json({ok:true,user:req.session.user});

  }catch(e){res.status(500).json({error:e.message});
  }
});
app.post("/api/auth/login",async(req,res)=>{
  try{
    const {email,password}=req.body;

    const result=await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if(!result.rows.length)
      return res.status(401).json({error:"ইমেইল পাওয়া যায়নি"});

    const user=result.rows[0];

    const match=bcrypt.compareSync(password,user.password);

    if(!match)
      return res.status(401).json({error:"পাসওয়ার্ড ভুল"});

    req.session.user={
      id:user.id,
      name:user.name,
      email:user.email,
      role:user.role
    };

    res.json({ok:true,user:req.session.user});

  }catch(e){
    res.status(500).json({error:e.message});
  }
});


app.post("/api/auth/logout",(req,res)=>{
  req.session.destroy(()=>{
    res.json({ok:true});
  });
});
app.get("/api/news",async(req,res)=>{
  try{
    const result=await pool.query(
      "SELECT * FROM news ORDER BY created_at DESC"
    );

    res.json(result.rows);  }catch(e){
    res.status(500).json({error:e.message});
  }
});
app.post("/api/news",async(req,res)=>{
  try{
    const {title,content,image}=req.body;

    const result=await pool.query(
      "INSERT INTO news(title,content,image) VALUES($1,$2,$3) RETURNING *",
      [title,content,image]
    );

    res.json(result.rows[0]);

  }catch(e){
    res.status(500).json({error:e.message});
  }
});
app.get("/api/admin/check",(req,res)=>{
  if(req.session.user && req.session.user.role==="admin"){
    return res.json({admin:true});
  }

  res.json({admin:false});
});


app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

