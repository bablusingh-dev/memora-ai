import { IGraphProvider } from './graph.interface.js';
import { Neo4jGraphProvider } from './neo4j.graph.provider.js';
import { logger } from '../../utils/logger.js';

let graphInstance: IGraphProvider | null = null;

export class GraphFactory {
  static getProvider(): IGraphProvider {
    if (graphInstance) return graphInstance;

    logger.info('Initializing Neo4j Graph Provider');
    graphInstance = new Neo4jGraphProvider();
    return graphInstance;
  }

  static setProvider(provider: IGraphProvider): void {
    graphInstance = provider;
  }
}
