
export interface Service {
  id: string;
  name: string;
}

export interface Category {
  id: string;
  name: string;
  sub_category: string;
}

export interface Item {
  id: string;
  name: string;
  category_id: string;
  stock_quantity: number;
  alert_threshold: number | null;
  category?: Category; // Joined data
  services?: Service[]; // Joined data
}

export interface OrderItem {
  id?: string;
  item_id: string;
  quantity: number;
  item?: Item; // Joined data
}

export interface Order {
  id: string;
  service_id: string;
  delivery_date: string;
  status: 'pending' | 'validated';
  order_items: OrderItem[];
  service?: Service; // Joined data
}

export type OrderPayload = {
  service_id: string;
  delivery_date: string;
  items: { item_id: string; quantity: number }[];
};