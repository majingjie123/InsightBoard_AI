interface ElectronAPI {
  selectFile(filters: { name: string; extensions: string[] }[]): Promise<{
    name: string;
    path: string;
    buffer: ArrayBuffer;
  } | null>;
  
  getServerPort(): Promise<number>;
  
  getConfig(key: string): Promise<any>;
  setConfig(key: string, value: any): Promise<boolean>;
  
  minimize(): void;
  maximize(): void;
  close(): void;
  
  onRequestSnapshotData(callback: (spaceId: string) => void): void;
  responseSnapshotData(spaceId: string, snapshot: any): void;
}

interface Window {
  electronAPI?: ElectronAPI;
}
