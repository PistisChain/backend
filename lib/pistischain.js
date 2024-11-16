const HttpServer = require('./httpServer/index.js');
const Blockchain = require('./blockchain/index.js');
const Operator = require('./operator/index.js');
const Miner = require('./miner/index.js');
const Node = require('./node/index.js');

module.exports = function pistischain(host, port, peers, logLevel, name) {
    host = process.env.HOST || host || 'localhost';
    port = process.env.PORT || process.env.HTTP_PORT || port || 3001;
    peers = (process.env.PEERS ? process.env.PEERS.split(',') : peers || []);
    peers = peers.map((peer) => { return { url: peer }; });
    logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);    
    name = process.env.NAME || name || '1';

    require('./util/consoleWrapper.js')(name, logLevel);

    console.info(`Starting node ${name}`);

    let blockchain = new Blockchain(name);
    let operator = new Operator(name, blockchain);
    let miner = new Miner(blockchain, logLevel);
    let node = new Node(host, port, peers, blockchain);
    let httpServer = new HttpServer(node, blockchain, operator, miner);

    // let operator2 = new Operator('b', blockchain);
    // let miner2 = new Miner(blockchain, logLevel);
    // let node2 = new Node(host, 3002, peers, blockchain);
    // let httpServer2 = new HttpServer(node2, blockchain, operator2, miner2);
    // httpServer2.listen(host, 3002);

    httpServer.listen(host, port);
};