const HttpServer = require('../lib/httpServer/index.js');
const Blockchain = require('../lib/blockchain/index.js');
const Transaction = require('../lib/blockchain/transaction.js');
const Operator = require('../lib/operator/index.js');
const Miner = require('../lib/miner/index.js');
const Node = require('../lib/node/index.js');
const express = require('express');
const detect = require('detect-port');
// const pitischain = require('../lib/pitischain');
const cors = require('cors');
const net = require('net');
const fs = require('fs');
const path = require('path');
const { error } = require('console');
// 定义数据目录路径
const host = 'localhost';
let peers = [];
const dataDir = path.join(__dirname, 'data');

// 获取 data 文件夹下的所有文件/文件夹
// const subdirs = fs.readdirSync(dataDir, { withFileTypes: true });

// // 找到第一个子文件夹
// const firstSubdir = subdirs.find(dirent => dirent.isDirectory());

const app = express();
app.use(cors())

const BASE_PORT = 3001;
let currentPort = BASE_PORT; // 当前可用的端口
let lastStartedPort = null;   // 上一个启动的端口
let isNodeRunning = false;    // 是否已有节点在运行

// 解析 JSON 请求体
app.use(express.json());

// 检查端口是否被占用
const isPortAvaliable = (port) => {
    const availablePort = detect(port);
    if (port === availablePort) {
        return true
    } else {
        return false
    }
};

// 登录 API：供学生登录
app.post('/login', async (req, res) => {
    const { studentId, password } = req.body;
    let blockchain = new Blockchain(studentId);
    let operator = new Operator(studentId, blockchain);
    if (isNodeRunning) {
        // 如果已有节点运行，设置 peers 为上一个端口
        peers = [`http://localhost:${lastStartedPort}`];
        return res.status(400).json({ error: 'Node already running', peers });
    }
    // 查找可用端口
    while (await isPortTaken(currentPort)) {
        currentPort++;
    }
    // const node = nodeManager.getNode(studentId);
    if (!node || node.wallet.password !== password) {
        return res.status(403).json({ error: 'Invalid credentials' });
    }
    res.json({ status: 'success', publicKey: node.wallet.publicKey });
});


app.post('/register', async (req, res) => {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
        return res.status(400).json({ error: 'Missing studentId or password' });
    }

    let blockchain = new Blockchain(studentId);
    let operator = new Operator(studentId, blockchain);
    if (isNodeRunning) {
        // 如果已有节点运行，设置 peers 为上一个端口
        peers = [{url: `http://localhost:${lastStartedPort}`}];
        // return res.status(400).json({ error: 'Node already running', peers });
    }

    try {
        // naivecoin(host || 'localhost', currentPort, [], logLevel || 6, name || 'Node 1');
        // 查找可用端口
        while (!isPortAvaliable(currentPort)) {
            currentPort++;
            break;
        }
        let miner = new Miner(blockchain);
        let node = new Node(host, currentPort, peers, blockchain);
        let httpServer = new HttpServer(node, blockchain, operator, miner);
        isNodeRunning = true;
        lastStartedPort = currentPort; // 保存上一个启动的端口
        httpServer.listen(host, currentPort);
        if (!operator.getWallets().length) {
            let newWallet = operator.createWalletFromPassword(password);
            let newAddress = operator.generateAddressForWallet(newWallet.id);
            let newTransaction = operator.createTransaction(newWallet.id,newAddress,'', 0, newAddress);
            let transactionCreated = blockchain.addTransaction(Transaction.fromJson(newTransaction));
            res.status(200).json({ message: 'Node started successfully', port: currentPort, wallet: newWallet, address: newAddress, transaction: transactionCreated });
        } else {
            res.status(400).json({ error: '已注册过，请登录' });
        }
        
    } catch (error) {
        console.error('Error starting node:', error);
        res.status(500).json({ error: 'Failed to start node' });
    }

    // // 注册公钥到区块链
    // const transaction = {
    //     type: 'register',
    //     data: {
    //         studentId: studentId,
    //         publicKey: wallet.publicKey
    //     },
    //     timestamp: new Date().toISOString()
    // };
    // blockchain.addTransaction(transaction);

    // res.json({ status: 'success', studentId, publicKey: wallet.publicKey });
});



// 启动服务
const PORT = process.env.PORT || 2888;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));