const express = require('express');
const bodyParser = require('body-parser');
const swaggerUi = require('swagger-ui-express');
const R = require('ramda');
const path = require('path');
const swaggerDocument = require('./swagger.json');
const Block = require('../blockchain/block');
const Transaction = require('../blockchain/transaction');
const TransactionAssertionError = require('../blockchain/transactionAssertionError');
const BlockAssertionError = require('../blockchain/blockAssertionError');
const HTTPError = require('./httpError');
const ArgumentError = require('../util/argumentError');
const CryptoUtil = require('../util/cryptoUtil');
const timeago = require('timeago.js');
const fs = require('fs');
const cors = require('cors');

class HttpServer {
    constructor(node, blockchain, operator, miner) {
        this.app = express();
        this.app.use(cors());
        const blocksFilePath = path.join(__dirname, '../../data/blocks.json');

        // 加载考勤数据
        const loadBlocksData = () => {
            const data = fs.readFileSync(blocksFilePath, 'utf-8');
            return JSON.parse(data);
        };
        
        // 提取考勤记录
        const extractAttendanceRecords = (blocks) => {
            return blocks.flatMap(block =>
                block.transactions
                    .filter(tx => tx.type === 'attendance')
                    .map(tx => ({
                        studentId: tx.studentId,
                        eventId: tx.eventId,
                        timestamp: tx.timestamp,
                        dateTime: new Date(tx.timestamp * 1000).toISOString().replace('T', ' ').split('.')[0],
                    }))
            );
        };
        
        this.app.get('/api/attendance/student', (req, res) => {
            const { studentId, startDate, endDate, year, weekNumber, monthNumber, startWeek: queryStartWeek, endWeek: queryEndWeek, startMonth: queryStartMonth, endMonth: queryEndMonth, granularity } = req.query;
            console.log(`Granularity: ${granularity}`);
            try {
                // 如果未提供 studentId，则返回空数组
                if (!studentId) {
                    res.send([]);
                    return;
                }
        
                const blocksData = loadBlocksData();
                const attendanceRecords = extractAttendanceRecords(blocksData);
        
                // 设置时间范围
                let startDateTime = startDate
                    ? new Date(Date.UTC(parseInt(startDate.split('-')[0]), parseInt(startDate.split('-')[1]) - 1, parseInt(startDate.split('-')[2]), 0, 0, 0))
                    : null;
        
                let endDateTime = endDate
                    ? new Date(Date.UTC(parseInt(endDate.split('-')[0]), parseInt(endDate.split('-')[1]) - 1, parseInt(endDate.split('-')[2]), 23, 59, 59))
                    : null;
        
                console.log(`Year: ${year}`);
                console.log(`QueryStartMonth: ${queryStartMonth}`);
                console.log(`QueryEndMonth: ${queryEndMonth}`);
        
                // 按粒度处理时间范围
                if (granularity === 'week' && year) {
                    const startWeekNumber = queryStartWeek ? parseInt(queryStartWeek) : weekNumber;
                    const endWeekNumber = queryEndWeek ? parseInt(queryEndWeek) : weekNumber;
                    if (startWeekNumber && endWeekNumber) {
                        const startOfWeek = getFirstDayOfWeek(year, startWeekNumber); // 起始周的周一
                        const endOfWeek = getFirstDayOfWeek(year, endWeekNumber); // 结束周的周一
                        startDateTime = new Date(startOfWeek.setHours(0, 0, 0, 0)); // 周一的开始时间
                        endDateTime = new Date(endOfWeek);
                        endDateTime.setDate(endOfWeek.getDate() + 6); // 周日的结束时间
                        endDateTime.setHours(23, 59, 59, 999);
                    }
                } else if (granularity === 'month' && year) {
                    const startMonth = queryStartMonth ? parseInt(queryStartMonth) : monthNumber;
                    const endMonth = queryEndMonth ? parseInt(queryEndMonth) : monthNumber;
                    if (startMonth && endMonth) {
                        startDateTime = new Date(year, startMonth - 1, 1, 0, 0, 0); // 起始月的第一天
                        endDateTime = new Date(year, endMonth, 0, 23, 59, 59); // 结束月的最后一天
                    }
                }
        
                console.log(`Start DateTime: ${startDateTime}`);
                console.log(`End DateTime: ${endDateTime}`);
        
                // 筛选记录
                const filteredData = attendanceRecords.filter(record => {
                    const recordDate = new Date(record.timestamp * 1000); // 转换记录的时间戳
                    const studentValid = record.studentId === studentId; // 必须匹配 studentId
                    const startDateValid = startDateTime ? recordDate >= startDateTime : true; // 开始日期校验
                    const endDateValid = endDateTime ? recordDate <= endDateTime : true; // 结束日期校验
                    return studentValid && startDateValid && endDateValid;
                });
        
                // 返回筛选后的数据
                res.send(filteredData);
            } catch (error) {
                console.error('Error fetching attendance data:', error);
                res.status(500).send({ error: 'Failed to fetch attendance data' });
            }
        });
        
        // 获取指定年和周的第一天
        function getFirstDayOfWeek(year, week) {
            const jan1 = new Date(year, 0, 1); // 当年1月1日
            const jan1Day = jan1.getDay(); // 1月1日是星期几（0=周日，1=周一）
            const daysOffset = (jan1Day === 0 ? -6 : 1) - jan1Day; // 调整到最近的周一
        
            const firstMonday = new Date(year, 0, 1 + daysOffset); // 第一个周一
            const daysToAdd = (week - 1) * 7; // 目标周偏移
            return new Date(firstMonday.setDate(firstMonday.getDate() + daysToAdd)); // 计算目标周的周一
        }
        

        // 查询班级考勤记录
        this.app.get('/api/attendance/course', (req, res) => {
            const { eventId, startDate, endDate, year, weekNumber, monthNumber, startWeek: queryStartWeek, endWeek: queryEndWeek, startMonth: queryStartMonth, endMonth: queryEndMonth, granularity } = req.query;
            console.log(`Granularity: ${granularity}`);
            try {
                // 如果未提供 eventId
                if (!eventId) {
                    res.send([]);
                    return;
                }
        
                const blocksData = loadBlocksData();
                const attendanceRecords = extractAttendanceRecords(blocksData);
        
                // 设置时间范围
                let startDateTime = startDate
                    ? new Date(Date.UTC(parseInt(startDate.split('-')[0]), parseInt(startDate.split('-')[1]) - 1, parseInt(startDate.split('-')[2]), 0, 0, 0))
                    : null;
        
                let endDateTime = endDate
                    ? new Date(Date.UTC(parseInt(endDate.split('-')[0]), parseInt(endDate.split('-')[1]) - 1, parseInt(endDate.split('-')[2]), 23, 59, 59))
                    : null;
        
                console.log(`Year: ${year}`);
                console.log(`QueryStartMonth: ${queryStartMonth}`);
                console.log(`QueryEndMonth: ${queryEndMonth}`);
        
                // 按粒度处理时间范围
                if (granularity === 'week' && year) {
                    const startWeekNumber = queryStartWeek ? parseInt(queryStartWeek) : weekNumber;
                    const endWeekNumber = queryEndWeek ? parseInt(queryEndWeek) : weekNumber;
                    if (startWeekNumber && endWeekNumber) {
                        const startOfWeek = getFirstDayOfWeek(year, startWeekNumber); // 起始周的周一
                        const endOfWeek = getFirstDayOfWeek(year, endWeekNumber); // 结束周的周一
                        startDateTime = new Date(startOfWeek.setHours(0, 0, 0, 0)); // 周一的开始时间
                        endDateTime = new Date(endOfWeek);
                        endDateTime.setDate(endOfWeek.getDate() + 6); // 周日的结束时间
                        endDateTime.setHours(23, 59, 59, 999);
                    }
                } else if (granularity === 'month' && year) {
                    const startMonth = queryStartMonth ? parseInt(queryStartMonth) : monthNumber;
                    const endMonth = queryEndMonth ? parseInt(queryEndMonth) : monthNumber;
                    if (startMonth && endMonth) {
                        startDateTime = new Date(year, startMonth - 1, 1, 0, 0, 0); // 起始月的第一天
                        endDateTime = new Date(year, endMonth, 0, 23, 59, 59); // 结束月的最后一天
                    }
                }
        
                console.log(`Start DateTime: ${startDateTime}`);
                console.log(`End DateTime: ${endDateTime}`);
        
                // 筛选记录
                const filteredData = attendanceRecords.filter(record => {
                    const recordDate = new Date(record.timestamp * 1000); // 转换记录的时间戳
                    const studentValid = record.eventId === eventId; // 必须匹配 studentId
                    const startDateValid = startDateTime ? recordDate >= startDateTime : true; // 开始日期校验
                    const endDateValid = endDateTime ? recordDate <= endDateTime : true; // 结束日期校验
                    return studentValid && startDateValid && endDateValid;
                });
        
                // 返回筛选后的数据
                res.send(filteredData);
            } catch (error) {
                console.error('Error fetching attendance data:', error);
                res.status(500).send({ error: 'Failed to fetch attendance data' });
            }
        });
        
        // 获取指定年和周的第一天
        function getFirstDayOfWeek(year, week) {
            const jan1 = new Date(year, 0, 1); // 当年1月1日
            const jan1Day = jan1.getDay(); // 1月1日是星期几（0=周日，1=周一）
            const daysOffset = (jan1Day === 0 ? -6 : 1) - jan1Day; // 调整到最近的周一
        
            const firstMonday = new Date(year, 0, 1 + daysOffset); // 第一个周一
            const daysToAdd = (week - 1) * 7; // 目标周偏移
            return new Date(firstMonday.setDate(firstMonday.getDate() + daysToAdd)); // 计算目标周的周一
        }

        
  
  
  

        const projectWallet = (wallet) => {
            return {
                id: wallet.id,
                addresses: R.map((keyPair) => {
                    return keyPair.publicKey;
                }, wallet.keyPairs)
            };
        };

        this.app.use(bodyParser.json());

        this.app.set('view engine', 'pug');
        this.app.set('views', path.join(__dirname, 'views'));
        this.app.locals.formatters = {
            time: (rawTime) => {
                const timeInMS = new Date(rawTime * 1000);
                return `${timeInMS.toLocaleString()} - ${timeago().format(timeInMS)}`;
            },
            hash: (hashString) => {
                return hashString != '0' ? `${hashString.substr(0, 5)}...${hashString.substr(hashString.length - 5, 5)}` : '<empty>';
            },
            amount: (amount) => amount.toLocaleString()
        };
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

        this.app.get('/blockchain', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/index.pug', {
                    pageTitle: 'Blockchain',
                    blocks: blockchain.getAllBlocks()
                });
            else
                throw new HTTPError(400, 'Accept content not supported');
        });

        this.app.get('/blockchain/blocks', (req, res) => {
            res.status(200).send(blockchain.getAllBlocks());
        });

        this.app.get('/blockchain/blocks/latest', (req, res) => {
            let lastBlock = blockchain.getLastBlock();
            if (lastBlock == null) throw new HTTPError(404, 'Last block not found');

            res.status(200).send(lastBlock);
        });

        this.app.put('/blockchain/blocks/latest', (req, res) => {
            let requestBlock = Block.fromJson(req.body);
            let result = node.checkReceivedBlock(requestBlock);

            if (result == null) res.status(200).send('Requesting the blockchain to check.');
            else if (result) res.status(200).send(requestBlock);
            else throw new HTTPError(409, 'Blockchain is update.');
        });

        this.app.get('/blockchain/blocks/:hash([a-zA-Z0-9]{64})', (req, res) => {
            let blockFound = blockchain.getBlockByHash(req.params.hash);
            if (blockFound == null) throw new HTTPError(404, `Block not found with hash '${req.params.hash}'`);

            res.status(200).send(blockFound);
        });

        this.app.get('/blockchain/blocks/:index', (req, res) => {
            let blockFound = blockchain.getBlockByIndex(parseInt(req.params.index));
            if (blockFound == null) throw new HTTPError(404, `Block not found with index '${req.params.index}'`);

            res.status(200).send(blockFound);
        });

        this.app.get('/blockchain/blocks/transactions/:transactionId([a-zA-Z0-9]{64})', (req, res) => {
            let transactionFromBlock = blockchain.getTransactionFromBlocks(req.params.transactionId);
            if (transactionFromBlock == null) throw new HTTPError(404, `Transaction '${req.params.transactionId}' not found in any block`);

            res.status(200).send(transactionFromBlock);
        });

        this.app.get('/blockchain/transactions', (req, res) => {
            if (req.headers['accept'] && req.headers['accept'].includes('text/html'))
                res.render('blockchain/transactions/index.pug', {
                    pageTitle: 'Unconfirmed Transactions',
                    transactions: blockchain.getAllTransactions()
                });
            else
                res.status(200).send(blockchain.getAllTransactions());
        });

        this.app.post('/blockchain/transactions', (req, res) => {
            let requestTransaction = Transaction.fromJson(req.body);
            let transactionFound = blockchain.getTransactionById(requestTransaction.id);

            if (transactionFound != null) throw new HTTPError(409, `Transaction '${requestTransaction.id}' already exists`);

            try {
                let newTransaction = blockchain.addTransaction(requestTransaction);
                res.status(201).send(newTransaction);
            } catch (ex) {
                if (ex instanceof TransactionAssertionError) throw new HTTPError(400, ex.message, requestTransaction, ex);
                else throw ex;
            }
        });

        this.app.get('/blockchain/transactions/unspent', (req, res) => {
            res.status(200).send(blockchain.getUnspentTransactionsForAddress(req.query.address));
        });

        this.app.get('/operator/wallets', (req, res) => {
            let wallets = operator.getWallets();

            let projectedWallets = R.map(projectWallet, wallets);

            res.status(200).send(projectedWallets);
        });

        this.app.post('/operator/wallets', (req, res) => {
            let password = req.body.password;
            if (R.match(/\w+/g, password).length <= 4) throw new HTTPError(400, 'Password must contain more than 4 words');

            let newWallet = operator.createWalletFromPassword(password);

            let projectedWallet = projectWallet(newWallet);

            res.status(201).send(projectedWallet);
        });

        this.app.get('/operator/wallets/:walletId', (req, res) => {
            let walletFound = operator.getWalletById(req.params.walletId);
            if (walletFound == null) throw new HTTPError(404, `Wallet not found with id '${req.params.walletId}'`);

            let projectedWallet = projectWallet(walletFound);

            res.status(200).send(projectedWallet);
        });

        this.app.post('/operator/wallets/:walletId/transactions', (req, res) => {
            let walletId = req.params.walletId;
            let password = req.headers.password;

            if (password == null) throw new HTTPError(401, 'Wallet\'s password is missing.');
            let passwordHash = CryptoUtil.hash(password);

            try {
                if (!operator.checkWalletPassword(walletId, passwordHash)) throw new HTTPError(403, `Invalid password for wallet '${walletId}'`);

                let newTransaction = operator.createTransaction(walletId, req.body.fromAddress, req.body.toAddress, req.body.amount, req.body['changeAddress'] || req.body.fromAddress);

                newTransaction.check();

                let transactionCreated = blockchain.addTransaction(Transaction.fromJson(newTransaction));
                res.status(201).send(transactionCreated);
            } catch (ex) {
                if (ex instanceof ArgumentError || ex instanceof TransactionAssertionError) throw new HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.get('/operator/wallets/:walletId/addresses', (req, res) => {
            let walletId = req.params.walletId;
            try {
                let addresses = operator.getAddressesForWallet(walletId);
                res.status(200).send(addresses);
            } catch (ex) {
                if (ex instanceof ArgumentError) throw new HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.post('/operator/wallets/:walletId/addresses', (req, res) => {
            let walletId = req.params.walletId;
            let password = req.headers.password;

            if (password == null) throw new HTTPError(401, 'Wallet\'s password is missing.');
            let passwordHash = CryptoUtil.hash(password);

            try {
                if (!operator.checkWalletPassword(walletId, passwordHash)) throw new HTTPError(403, `Invalid password for wallet '${walletId}'`);

                let newAddress = operator.generateAddressForWallet(walletId);
                res.status(201).send({ address: newAddress });
            } catch (ex) {
                if (ex instanceof ArgumentError) throw new HTTPError(400, ex.message, walletId, ex);
                else throw ex;
            }
        });

        this.app.get('/operator/:addressId/balance', (req, res) => {
            let addressId = req.params.addressId;

            try {
                let balance = operator.getBalanceForAddress(addressId);
                res.status(200).send({ balance: balance });
            } catch (ex) {
                if (ex instanceof ArgumentError) throw new HTTPError(404, ex.message, { addressId }, ex);
                else throw ex;
            }
        });

        this.app.get('/node/peers', (req, res) => {
            res.status(200).send(node.peers);
        });

        this.app.post('/node/peers', (req, res) => {
            let newPeer = node.connectToPeer(req.body);
            res.status(201).send(newPeer);
        });

        this.app.get('/node/transactions/:transactionId([a-zA-Z0-9]{64})/confirmations', (req, res) => {
            node.getConfirmations(req.params.transactionId)
                .then((confirmations) => {
                    res.status(200).send({ confirmations: confirmations });
                });
        });

        this.app.post('/miner/mine', (req, res, next) => {
            miner.mine(req.body.rewardAddress, req.body['feeAddress'] || req.body.rewardAddress)
                .then((newBlock) => {
                    newBlock = Block.fromJson(newBlock);
                    blockchain.addBlock(newBlock);
                    res.status(201).send(newBlock);
                })
                .catch((ex) => {
                    if (ex instanceof BlockAssertionError && ex.message.includes('Invalid index')) next(new HTTPError(409, 'A new block were added before we were able to mine one'), null, ex);
                    else next(ex);
                });
        });

        //querying
        // 教师查询学生出勤记录
        // this.app.get('/attendance', (req, res) => {
        //     const { studentId, classId, startDate, endDate } = req.query;
        
        //     // 获取区块链中的所有交易
        //     const allTransactions = blockchain.getAllTransactions();
        
        //     // 过滤交易，找到符合条件的考勤记录
        //     const filteredTransactions = allTransactions.filter((tx) => {
        //         const matchesStudent = studentId ? tx.studentId === studentId : true;
        //         const matchesClass = classId ? tx.classId === classId : true;
        //         const matchesDate = startDate && endDate ? new Date(tx.date * 1000) >= new Date(startDate) &&
        //   new Date(tx.date * 1000) <= new Date(endDate): true;

        //     return matchesStudent && matchesClass && matchesDate;
        //     });
        
        //     if (filteredTransactions.length === 0) {
        //         res.status(404).send({ message: 'No attendance records found.' });
        //     } else {
        //         res.status(200).send(filteredTransactions);
        //     }
        // });
        

        this.app.use(function (err, req, res, next) {  // eslint-disable-line no-unused-vars
            if (err instanceof HTTPError) res.status(err.status);
            else res.status(500);
            res.send(err.message + (err.cause ? ' - ' + err.cause.message : ''));
        });
    }

    listen(host, port) {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(port, host, (err) => {
                if (err) reject(err);
                console.info(`Listening http on port: ${this.server.address().port}, to access the API documentation go to http://${host}:${this.server.address().port}/api-docs/`);
                resolve(this);
            });
        });
    }

    stop() {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                console.info('Closing http');
                resolve(this);
            });
        });
    }
}

module.exports = HttpServer;