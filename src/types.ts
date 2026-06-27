export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  available: boolean;
  prep_time?: string;
  calories?: number;
  origin?: string;
  is_spicy?: boolean;
  is_popular?: boolean;
  allergens?: string;
  protein?: string;
  fat?: string;
}

export interface OrderItem {
  id?: string;
  menu_item_id: string;
  item_name?: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  table_number: string;
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  total_amount: number;
  payment_status: 'unpaid' | 'paid';
  payment_method?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  price: number;
  last_updated: string;
}

export interface Table {
  id: string;
  number: string;
  qr_code: string;
}

export interface WasteItem {
  id: string;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string;
  date: string;
}
