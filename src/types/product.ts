export interface ProductScheduleEntry {
  stage: string
  days: number
}

export interface Product {
  id: string
  orgId: string
  name: string
  description: string
  price: number
  hourValue: number
  margin: number
  tax: number
  schedule: ProductScheduleEntry[]
  createdBy?: string
  createdAt: string
  updatedAt: string
}

export const EMPTY_PRODUCT: Omit<Product, 'id' | 'orgId' | 'createdAt' | 'updatedAt'> = {
  name: '',
  description: '',
  price: 0,
  hourValue: 0,
  margin: 0,
  tax: 0,
  schedule: [],
}
