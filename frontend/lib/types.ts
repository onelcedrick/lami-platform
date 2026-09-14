export interface OrderItem {
  product_id: string;
  product_name?: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image_url?: string;
}

export interface Address {
  street: string;
  city: string;
  postal_code: string;
  country: string;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  items: OrderItem[];
  sub_total: number;
  shipping_cost: number;
  tax: number;
  discount: number;
  total: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  shipping_address: Address;
  notes?: string;
  tracking_number?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketMessage {
  id: string;
  author_id: string;
  author_role: string;
  content: string;
  is_internal: boolean;
  created_at: string;
}

export interface TicketNote {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  user_id: string;
  assigned_to?: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  attachments?: string[];
  messages?: TicketMessage[];
  internal_notes?: TicketNote[];
  related_order_id?: string;
  related_product_id?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmee",
  processing: "En traitement",
  shipped: "Expediee",
  delivered: "Livree",
  cancelled: "Annulee",
  refunded: "Rembourse",
};

export const TICKET_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  waiting: "En attente",
  resolved: "Resolu",
  closed: "Clos",
};

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  critical: "Critique",
  high: "Haute",
  medium: "Moyenne",
  low: "Basse",
};

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    confirmed: "bg-blue-100 text-blue-800",
    processing: "bg-indigo-100 text-indigo-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
    refunded: "bg-slate-100 text-slate-800",
    open: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    waiting: "bg-orange-100 text-orange-800",
    resolved: "bg-emerald-100 text-emerald-800",
    closed: "bg-slate-100 text-slate-800",
    critical: "bg-red-100 text-red-800",
    high: "bg-orange-100 text-orange-800",
    medium: "bg-yellow-100 text-yellow-800",
    low: "bg-slate-100 text-slate-700",
  };
  return map[status] || "bg-slate-100 text-slate-700";
}
