export interface ICanMerge {
  onApprove(reference: string): Promise<void>;
  onReject(reference: string): Promise<void>;
  onCheck(reference: string): Promise<Check[]>;
}

export interface Check {
  status: 'passed' | 'pending' | 'failed';
  cache: boolean;
  message?: string;
}
