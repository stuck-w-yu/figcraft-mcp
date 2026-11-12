export interface FigcraftMcpOptions {
  port: number;
  headless: boolean;
  attachOnly: boolean;
  timeout: number;
  rootPath: string;
  cliPath?: string;
  verbose: boolean;
}

export interface BackendStatus {
  cliFound: boolean;
  cliPath?: string;
  appListening: boolean;
  port: number;
  mode: 'attached' | 'headless';
}
