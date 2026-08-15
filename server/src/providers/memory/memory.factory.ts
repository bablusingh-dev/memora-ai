import { IMemoryProvider } from './memory.interface.js';
import { SelfHostedMemoryProvider } from './self-hosted.memory.provider.js';
import { CloudMemoryProvider } from './cloud.memory.provider.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let memoryInstance: IMemoryProvider | null = null;

export class MemoryFactory {
  static getProvider(): IMemoryProvider {
    if (memoryInstance) return memoryInstance;

    if (env.MEMORY_PROVIDER === 'mem0_cloud') {
      logger.info('Initializing Mem0 Cloud Memory Provider');
      memoryInstance = new CloudMemoryProvider();
    } else {
      logger.info('Initializing Self-Hosted Memory Provider (Docker / Local)');
      memoryInstance = new SelfHostedMemoryProvider();
    }

    return memoryInstance;
  }

  static setProvider(provider: IMemoryProvider): void {
    memoryInstance = provider;
  }
}
