import type { Timestamp } from 'firebase/firestore';

export interface ServiceProduct {
  sku: string;
  displayName: string;
  description?: string;
  unit: 'TONELADA';
  pricePerUnit?: number;
  active: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}
