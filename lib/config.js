// Do not change these configurations after the blockchain is initialized
module.exports = {
    // INFO: The mining reward could decreases over time like bitcoin. See https://en.bitcoin.it/wiki/Mining#Reward.
    MINING_REWARD: 5000000000,
    // INFO: Usually it's a fee over transaction size (not quantity)
    FEE_PER_TRANSACTION: 1,
    // INFO: Usually the limit is determined by block size (not quantity)
    TRANSACTIONS_PER_BLOCK: 2,
    genesisBlock: {
        index: 0,
        previousHash: '0',
        timestamp: 1465154705,
        nonce: 0,
        transactions: [
            {
                id: '63ec3ac02f822450039df13ddf7c3c0f19bab4acd4dc928c62fcd78d5ebc6dba',
                hash: null,
                type: 'regular',
                data: {
                    inputs: [],
                    outputs: []
                }
            }
        ]
    },
    pow: {
        BLOCK_GENERATION_INTERVAL: 10 * 60, // 10 minutes (单位：秒)
        DIFFICULTY_ADJUSTMENT_INTERVAL: 2016, // 每 2016 个区块调整一次难度

        getDifficulty: (blocks, index) => {
            const BASE_DIFFICULTY = Number.MAX_SAFE_INTEGER;
            const EVERY_X_BLOCKS = 5;
            const POW_CURVE = 5;

            // 计算时间差
            const currentBlock = blocks[index];
            const adjustmentBlockIndex = Math.max(0, index - module.exports.pow.DIFFICULTY_ADJUSTMENT_INTERVAL);
            const adjustmentBlock = blocks[adjustmentBlockIndex];

            const timeTaken = currentBlock.timestamp - adjustmentBlock.timestamp;
            const expectedTime = module.exports.pow.DIFFICULTY_ADJUSTMENT_INTERVAL * module.exports.pow.BLOCK_GENERATION_INTERVAL;

            // 根据时间调整难度
            let difficultyAdjustment = 1;
            if (timeTaken < expectedTime) {
                // 生成块的时间比预期快，增加难度
                difficultyAdjustment = 0.995;
            } else if (timeTaken > expectedTime) {
                // 生成块的时间比预期慢，减少难度
                difficultyAdjustment = 1.005;
            }

            // 计算最终的难度
            let difficulty = Math.max(
                Math.floor(BASE_DIFFICULTY / Math.pow(Math.floor(((index || blocks.length) + 1) / EVERY_X_BLOCKS) + 1, POW_CURVE)),
                0
            );

            difficulty = difficulty * difficultyAdjustment;

            return Math.floor(difficulty);
        }
    }
};