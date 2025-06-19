// lifoQueue.js
export class LIFOQueue {
    constructor() {
        this.stack = [];
        this.processing = false;
        
        // may need adjustment
        this.maxConcurrent = 1;
        this.processingCount = 0;
    }

    async addTask(task) {
        return new Promise((resolve, reject) => {
            this.stack.push({ task, resolve, reject });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.processing || this.processingCount >= this.maxConcurrent) {
            return;
        }

        this.processing = true;
        
        while (this.stack.length > 0 && this.processingCount < this.maxConcurrent) {
            const { task, resolve, reject } = this.stack.pop();
            this.processingCount++;

            try {
                const result = await task();
                resolve(result);
            } catch (error) {
                reject(error);
            } finally {
                this.processingCount--;
            }
        }

        this.processing = false;

        if (this.stack.length > 0 && this.processingCount < this.maxConcurrent) {
            this.processQueue();
        }
    }

    get size() {
        return this.stack.length;
    }

    clear() {
        this.stack = [];
    }
}

export const lifoQueue = new LIFOQueue();