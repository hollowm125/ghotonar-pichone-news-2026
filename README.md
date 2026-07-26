# ঘটনার পিছনে — Termux/Android Compatible

এই সংস্করণে `better-sqlite3` বাদ দেওয়া হয়েছে। তাই Android/Termux-এ native SQLite compilation বা NDK লাগবে না। ডেটা `data/database.json`-এ সংরক্ষিত হবে।

## Termux-এ চালানো

```bash
cd ~/ghotonar_pichone_news_mobile
npm install
npm start
```

তারপর ব্রাউজারে খুলুন: http://localhost:3000

Admin: http://localhost:3000/admin.html

ডিফল্ট Admin:
- Email: admin@ghotonarpichone.com
- Password: Admin@12345

## গুরুত্বপূর্ণ

- সাধারণ ব্যবহারকারীর জন্য লগইন বাধ্যতামূলক নয়।
- বিজ্ঞাপনদাতাদের জন্য Register/Login আছে।
- মন্তব্য moderation-এর জন্য Admin approval আছে।
- বিজ্ঞাপন submission ও Admin approval আছে।
- ডেটা `data/database.json`-এ থাকে।
- Production-এ ব্যবহারের আগে admin password এবং SESSION_SECRET পরিবর্তন করুন।
