// ไฟล์: db.js
const mysql = require('mysql2');

const db = mysql.createConnection({
    host: 'localhost',
    user: 'navarat',      // ปกติ XAMPP จะใช้ user เป็น root
    password: '1139600295902',      // ⚠️ ใส่รหัสผ่าน MySQL ของคุณ (ถ้าไม่ได้ตั้งไว้ ก็ปล่อยว่างแบบนี้)
    database: 'navarat' // ✅ ชื่อต้องตรงกับในรูปที่คุณส่งมา
});

db.connect((err) => {
    if (err) {
        console.error('Database connection failed : ' + err.stack);
        return;
    }
    console.log('Connected successfully');
});

module.exports = db;