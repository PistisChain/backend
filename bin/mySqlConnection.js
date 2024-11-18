const express = require('express');
const mysql = require('mysql2');

const app = express();

// create MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',       // 数据库主机
    user: 'root',    // 数据库用户名
    password: '123456', // 数据库密码
    database: 'comp5521'    // 数据库名称
});

// connect to MySQL
connection.connect(err => {
    if (err) {
        console.error('MySQL connection error:', err);
        return;
    }
    console.log('MySQL connected successfully');
});


// query data
app.get('/users', (req, res) => {
    connection.query('SELECT * FROM users', (err, results) => {
        if (err) {
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

// start server
const PORT = process.env.PORT||2999;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = connection;