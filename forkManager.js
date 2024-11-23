const BlockchainAssertionError = require('./blockchainAssertionError');
class ForkManager {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.forks = new Map();  // 存储潜在的分叉
    }

    // 处理新接收的区块
    async handleNewBlock(block) {
        const currentTop = this.blockchain.getLastBlock();
        
        // 检查是否存在分叉
        if (block.previousHash === currentTop.hash) {
            // 常规区块，直接添加
            return this.blockchain.addBlock(block);
        } else {
            // 可能的分叉情况
            return this.handlePotentialFork(block);
        }
    }

    // 处理潜在的分叉
    async handlePotentialFork(block) {
        // 1. 找到分叉点
        const forkPoint = this.findForkPoint(block);
        
        // 2. 重构分叉链
        const forkChain = await this.reconstructForkChain(block);
        
        // 3. 评估分叉
        if (this.shouldReplaceCurrent(forkChain)) {
            // 4. 替换现有链
            await this.blockchain.replaceChain(forkChain);
            return true;
        }
        return false;
    }

    // 找到分叉点
    findForkPoint(block) {
        let currentBlock = block;
        let mainChainBlock;
        
        while (currentBlock) {
            mainChainBlock = this.blockchain.getBlockByHash(currentBlock.previousHash);
            if (mainChainBlock) {
                return mainChainBlock;
            }
            currentBlock = this.forks.get(currentBlock.previousHash);
        }
        return null;
    }

    // 评估是否应该替换当前链
    shouldReplaceCurrent(forkChain) {
        // 1. 检查链长度
        if (forkChain.length <= this.blockchain.getAllBlocks().length) {
            return false;
        }

        // 2. 检查工作量证明总和
        const currentChainDifficulty = this.calculateChainDifficulty(
            this.blockchain.getAllBlocks()
        );
        const forkChainDifficulty = this.calculateChainDifficulty(forkChain);

        return forkChainDifficulty > currentChainDifficulty;
    }

    // 计算链的总难度
    calculateChainDifficulty(chain) {
        return chain.reduce((sum, block) => {
            return sum + Math.pow(2, block.difficulty);
        }, 0);
    }
}

module.exports = ForkManager;