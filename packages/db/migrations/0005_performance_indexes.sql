-- Performance indexes for high-frequency query columns
-- bookings: ordered list, unread count, slot association
CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_is_read ON bookings (is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot_id ON bookings (time_slot_id) WHERE time_slot_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);

-- cart_orders: ordered list, unread count
CREATE INDEX IF NOT EXISTS idx_cart_orders_created_at ON cart_orders (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_orders_is_read ON cart_orders (is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_cart_orders_status ON cart_orders (status);

-- cart_order_items: join on order_id
CREATE INDEX IF NOT EXISTS idx_cart_order_items_order_id ON cart_order_items (order_id);

-- time_slots: calendar queries
CREATE INDEX IF NOT EXISTS idx_time_slots_date ON time_slots (date);
CREATE INDEX IF NOT EXISTS idx_time_slots_date_category ON time_slots (date, category_id);

-- diy_projects: category filtering
CREATE INDEX IF NOT EXISTS idx_diy_projects_category_id ON diy_projects (category_id) WHERE category_id IS NOT NULL;

-- cart_sessions: cleanup of expired sessions
CREATE INDEX IF NOT EXISTS idx_cart_sessions_expires_at ON cart_sessions (expires_at);
