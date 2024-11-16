
class Student {
    constructor(id, node, miner, operator, blockchain) {
        this.id = id; // 学生唯一 ID
        this.role = "student";
        this.node = node; // 绑定节点
        this.miner = miner; // 绑定矿工
        this.operator = operator; // 绑定操作模块
        this.blockchain = blockchain; // 绑定区块链
    }


    // 学生提交签到交易
    submitSignIn(eventId) {
        const transaction = {
            type: "signIn",
            data: {
                studentId: this.id,
                eventId: eventId,
                timestamp: new Date().toISOString()
            }
        };

        // 添加到交易池
        this.operator.createTransaction(transaction);

        // 广播交易
        this.node.broadcastTransaction(transaction);
        console.log(`Student ${this.id} submitted sign-in transaction.`);
    }
}

module.exports = Student;
