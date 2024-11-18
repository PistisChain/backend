// userRegister.js
const db = require('./db'); // 引入数据库连接模块

// 获取所有学生
const getAllStudents = (callback) => {
    db.query('SELECT * FROM students', (err, results) => {
        if (err) {
            return callback(err);
        }
        callback(null, results);
    });
};

// 添加学生
const addStudent = (student, callback) => {
    const { name, role, public_key, wallet_id, address } = student;
    db.query('INSERT INTO students (name, role, public_key, wallet_id, address) VALUES (?, ?, ?, ?, ?)',
        [name, role, public_key, wallet_id, address], (err, results) => {
            if (err) {
                return callback(err);
            }
            callback(null, results.insertId); // 返回新插入的学生ID
        });
};

module.exports = { getAllStudents, addStudent };