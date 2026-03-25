const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db'); 

const app = express();
app.use(cors());
app.use(express.json());

// บอก Server ว่าไฟล์ HTML อยู่ในโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// ลองสร้างเส้นทางทดสอบ (Test Route)
app.get('/test-users', (req, res) => {
    db.query('SELECT * FROM users', (err, results) => {
        if (err) {
            res.status(500).send('Error ดึงข้อมูลไม่ได้');
        } else {
            res.json(results);
        }
    });
});

// --- API สำหรับสมัครสมาชิก ---
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const checkEmail = "SELECT * FROM users WHERE email = ?";
    db.query(checkEmail, [email], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database Error' });
        
        if (result.length > 0) {
            return res.status(400).json({ message: 'อีเมลนี้ถูกใช้งานแล้ว' });
        }

        const sql = "INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, 'student')";
        db.query(sql, [username, email, password], (err, result) => {
            if (err) return res.status(500).json({ message: 'สมัครสมาชิกไม่สำเร็จ' });
            res.json({ message: 'สมัครสมาชิกสำเร็จ!', success: true });
        });
    });
});

// --- API สำหรับเข้าสู่ระบบ (Login) ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    const sql = "SELECT * FROM users WHERE username = ? AND password = ?";
    
    db.query(sql, [username, password], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database Error' });

        if (results.length > 0) {
            res.json({ 
                success: true, 
                message: 'เข้าสู่ระบบสำเร็จ', 
                user: results[0] 
            });
        } else {
            res.status(401).json({ 
                success: false, 
                message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' 
            });
        }
    });
});

// API ดึงรายชื่อบทเรียน
app.get('/api/lessons', (req, res) => {
    const sql = "SELECT id, title, description FROM lessons ORDER BY order_index";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Database Error' });
        res.json(results);
    });
});

// API ดึงเนื้อหาบทเรียน
app.get('/api/lessons/:id', (req, res) => {
    const lessonId = req.params.id;
    const sql = "SELECT * FROM lessons WHERE id = ?";
    db.query(sql, [lessonId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database Error' });
        if (results.length > 0) res.json(results[0]);
        else res.status(404).json({ message: 'ไม่พบเนื้อหา' });
    });
});

// API: ดึงโจทย์
app.get('/api/quizzes/:lessonId', (req, res) => {
    const sql = "SELECT * FROM quizzes WHERE lesson_id = ?";
    db.query(sql, [req.params.lessonId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(results);
    });
});

// --- server.js (แก้เฉพาะท่อนล่าง) ---

// --- ✅ แก้ไข 1: API Dashboard (ใช้ status แทน is_completed) ---
app.get('/api/dashboard/:userId', (req, res) => {
    const userId = req.params.userId;

    // แก้ตรง WHERE status = 'completed' ให้ตรงกับ DB ของคุณ
    const sql = `
        SELECT 
            COUNT(*) as completed, 
            COALESCE(SUM(quiz_score), 0) as total_score 
        FROM progress 
        WHERE user_id = ? AND status = 'completed'
    `;

    db.query(sql, [userId], (err, results) => {
        if (err) {
            console.error(err); // ให้มันปริ้น Error ออกมาดูใน Terminal ถ้ามีปัญหา
            return res.status(500).json({ message: 'Database Error' });
        }
        
        res.json({
            completed: results[0].completed,
            total_score: results[0].total_score,
            last_lesson: results[0].completed 
        });
    });
});

// ---  แก้ไข 2: API บันทึกคะแนน (ใช้ status แทน is_completed) ---
app.post('/api/score', (req, res) => {
    const { userId, lessonId, score } = req.body;

    const checkSql = "SELECT * FROM progress WHERE user_id = ? AND lesson_id = ?";
    
    db.query(checkSql, [userId, lessonId], (err, results) => {
        if (err) return res.status(500).json({ message: 'Database Error' });

        if (results.length > 0) {
            // ถ้ามีแล้ว อัปเดตคะแนน
            const oldScore = results[0].quiz_score;
            if (score > oldScore) {
                // แก้เป็น status = 'completed'
                const updateSql = "UPDATE progress SET quiz_score = ?, status = 'completed' WHERE id = ?";
                db.query(updateSql, [score, results[0].id]);
            }
        } else {
            // ถ้ายังไม่มี สร้างใหม่ (แก้เป็น status = 'completed')
            const insertSql = "INSERT INTO progress (user_id, lesson_id, quiz_score, status) VALUES (?, ?, ?, 'completed')";
            db.query(insertSql, [userId, lessonId, score]);
        }
        res.json({ success: true, message: 'บันทึกคะแนนเรียบร้อย' });
    });
});

// API: Admin ดึงรายชื่อ User ทั้งหมด (ยกเว้นรหัสผ่าน)
app.get('/api/admin/users', (req, res) => {
    const sql = "SELECT id, username, email, role, created_at FROM users ORDER BY id DESC";
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ message: 'Error' });
        res.json(results);
    });
});

// API: เพิ่มบทเรียนใหม่ (Admin Only)
app.post('/api/admin/lessons', (req, res) => {
    const { title, description, content, order_index } = req.body;

    // ตรวจสอบค่าว่าง
    if (!title || !content) {
        return res.status(400).json({ message: 'กรุณากรอกชื่อบทเรียนและเนื้อหา' });
    }

    const sql = "INSERT INTO lessons (title, description, content, order_index) VALUES (?, ?, ?, ?)";
    db.query(sql, [title, description, content, order_index], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database Error' });
        }
        res.json({ success: true, message: 'เพิ่มบทเรียนเรียบร้อย!' });
    });
});

// API: แก้ไขบทเรียน (Update)
app.put('/api/admin/lessons/:id', (req, res) => {
    const id = req.params.id;
    const { title, description, content, order_index } = req.body;

    const sql = "UPDATE lessons SET title=?, description=?, content=?, order_index=? WHERE id=?";
    db.query(sql, [title, description, content, order_index, id], (err, result) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: 'Database Error' });
        }
        res.json({ success: true, message: 'แก้ไขบทเรียนเรียบร้อย!' });
    });
});

// API: ลบบทเรียน (Delete)
app.delete('/api/admin/lessons/:id', (req, res) => {
    const id = req.params.id;
    db.query("DELETE FROM lessons WHERE id=?", [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Database Error' });
        res.json({ success: true, message: 'ลบบทเรียนเรียบร้อย!' });
    });
});

app.listen(3000, () => {
    console.log('Server : http://localhost:3000');
});