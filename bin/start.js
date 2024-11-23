const HttpServer = require('../lib/httpServer/index.js');
const Blockchain = require('../lib/blockchain/index.js');
const Transaction = require('../lib/blockchain/transaction.js');
const Operator = require('../lib/operator/index.js');
const Miner = require('../lib/miner/index.js');
const Node = require('../lib/node/index.js');
const express = require('express');
const detect = require('detect-port');
const CryptoUtil = require('../lib/util/cryptoUtil');
const cors = require('cors');
const host = 'localhost';
const runningSet = new Set();
const runningPort = new Set();
let peers = [];

const app = express();
app.use(cors());

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
        return true;
    } else {
        return false;
    }
};

// 登录 API：供学生登录
app.post('/login', (req, res) => {
    const { studentId, password } = req.body;
    let blockchain = new Blockchain(studentId);
    let blocks = blockchain.getAllBlocks();
    let flag = 0;
    for (const block of blocks) {
        for (const transaction of block.transactions) {
            if (transaction.type === 'register' && transaction.studentId === studentId && CryptoUtil.hash(password) !== transaction.passwordHash) {
                return res.status(400).json({ error: '密码错误' });
            } else if (transaction.type === 'register' && transaction.studentId === studentId && CryptoUtil.hash(password) === transaction.passwordHash) {
                flag++;
                break;
            }
        }
        if (flag) break;
    }
    if (!flag) {
        return res.status(400).json({ error: '未找到账号' });
    }
    if (isNodeRunning) {
        // 如果已有节点运行，设置 peers 为上一个端口
        peers = [`http://localhost:${lastStartedPort}`];
        if (runningSet.has(studentId)) {
            return res.status(400).json({ error: 'this node is already running'});
        }
    }
    // 查找可用端口
    while (!isPortAvaliable(currentPort)) {
        currentPort++;
        break;
    }
    let operator = new Operator(studentId, blockchain);
    let wallet = operator.getWallet();
    let address = operator.getAddressForWallet(wallet.id);
    let miner = new Miner(blockchain);
    let node = new Node(host, currentPort, peers, blockchain);
    let httpServer = new HttpServer(node, blockchain, operator, miner);
    isNodeRunning = true;
    lastStartedPort = currentPort; // 保存上一个启动的端口
    httpServer.listen(host, currentPort);
    runningPort.add(currentPort);
    console.log('running port:', runningPort);
    runningSet.add(studentId);
    return res.json({ status: 'success', port: currentPort, wallet: wallet,  address:address});
});


app.post('/register', (req, res) => {
    const { studentId, password } = req.body;
    if (!studentId || !password) {
        return res.status(400).json({ error: 'Missing studentId or password' });
    }

    let blockchain = new Blockchain(studentId);
    let operator = new Operator(studentId, blockchain);
    if (isNodeRunning) {
        // 如果已有节点运行，设置 peers 为上一个端口
        peers = [{ url: `http://localhost:${lastStartedPort}` }];
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
            let newTransaction = operator.createRegister(newWallet.id, newAddress, 0, newAddress, studentId, null, Date.now(), CryptoUtil.hash(password));
            let transactionCreated = blockchain.addTransaction(Transaction.fromJson(newTransaction));
            runningPort.add(currentPort);
            console.log('running port:', runningPort);
            res.status(200).json({ message: 'Node started successfully', port: currentPort, wallet: newWallet, address: newAddress, transaction: transactionCreated });
        } else {
            return res.status(400).json({ error: '已注册过，请登录' });
        }

    } catch (error) {
        console.error('Error starting node:', error);
        return res.status(500).json({ error: 'Failed to start node' });
    }
});



// 启动服务
const PORT = process.env.PORT || 2888;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));