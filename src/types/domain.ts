export type Row = { id?: string; workspace_id?: string; [key: string]: unknown };
export const modules = [
  'dashboard',
  'products',
  'suppliers',
  'deposits',
  'inventory',
  'shopee',
  'reconciliation',
  'reseller',
  'b2b',
  'finance',
  'reports',
  'settings',
] as const;
export type Module = (typeof modules)[number];
export type Action = 'view' | 'create' | 'edit' | 'post' | 'export';
export type Membership = {
  id: string;
  workspace_id: string;
  role: 'OWNER' | 'MEMBER';
  email: string;
  active: boolean;
};
export type Permission = {
  module: Module;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_post: boolean;
  can_export: boolean;
};
export interface OrderLine {
  sku_id: string;
  qty: number;
  normal_unit_price: number;
  selling_unit_price: number;
  description?: string;
  external_item_id?: string;
  allocations: Allocation[];
}
export interface Allocation {
  fulfillment_type: 'LOCAL_STOCK' | 'SUPPLIER';
  qty: number;
  supplier_id?: string;
  inventory_location_id?: string;
  procurement_item_id?: string;
}
export interface OrderInput {
  order_date: string;
  channel: string;
  customer_id?: string;
  address_id?: string;
  external_order_number?: string;
  notes?: string;
  items: OrderLine[];
  discount: number;
}
