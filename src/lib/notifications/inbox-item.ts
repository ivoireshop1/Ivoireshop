export type InboxItem = {
  id: string;
  kind: "order" | "announcement";
  title: string;
  message: string;
  created_at: string;
  read_at: string | null;
  dismissed_at?: string | null;
  order_id?: string | null;
  confirmation_code?: string | null;
  event_type: string;
  action_label?: string | null;
  action_href?: string | null;
};
