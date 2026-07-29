import { createDb } from "@yezz/db";

const configuredTestUrl = process.env.TEST_DATABASE_URL;

export function requireSafeRequestFlowTestUrl(): string {
  if (!configuredTestUrl) {
    throw new Error(
      "TEST_DATABASE_URL is required when YEZYY_RUN_DB_BOOKING_TESTS=1",
    );
  }
  if (configuredTestUrl === process.env.DATABASE_URL) {
    throw new Error(
      "Booking tests refuse TEST_DATABASE_URL when it equals DATABASE_URL",
    );
  }
  const databaseName = decodeURIComponent(
    new URL(configuredTestUrl).pathname.slice(1),
  );
  if (!/(?:test|local|dev)/i.test(databaseName)) {
    throw new Error(
      `Booking tests refuse database "${databaseName}"; its name must include test, local, or dev`,
    );
  }
  return configuredTestUrl;
}

function withSearchPath(url: string, schema: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set("options", `-csearch_path=${schema}`);
  return parsed.toString();
}

export type RequestFlowTestDatabase = {
  schema: string;
  bootstrap: ReturnType<typeof createDb>;
  connection: ReturnType<typeof createDb>;
  close(): Promise<void>;
};

export async function createRequestFlowTestDatabase(): Promise<RequestFlowTestDatabase> {
  const url = requireSafeRequestFlowTestUrl();
  const schema = `yezyy_booking_test_${crypto.randomUUID().replaceAll("-", "")}`;
  const bootstrap = createDb(url);
  await bootstrap.client.unsafe(`CREATE SCHEMA "${schema}"`);
  await bootstrap.client.unsafe(`
    CREATE TABLE "${schema}".users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email varchar(255) NOT NULL UNIQUE,
      password_hash varchar(255) NOT NULL,
      name varchar(255) NOT NULL,
      role varchar(32) NOT NULL DEFAULT 'staff',
      session_version integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".project_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name jsonb NOT NULL,
      slug varchar(128) NOT NULL UNIQUE,
      description jsonb,
      icon varchar(64),
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".diy_projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id uuid NOT NULL REFERENCES "${schema}".project_categories(id),
      name jsonb NOT NULL,
      slug varchar(128) NOT NULL UNIQUE,
      project_type varchar(32) NOT NULL,
      description jsonb,
      price_range varchar(64),
      price_min integer,
      price_max integer,
      price_currency varchar(10) DEFAULT 'AUD',
      duration varchar(64),
      duration_minutes integer,
      bookable boolean NOT NULL DEFAULT false,
      variant_selected_in_store boolean NOT NULL DEFAULT false,
      extra_time_minutes integer,
      extra_time_price_cents integer,
      tags text[],
      sort_order integer NOT NULL DEFAULT 0,
      cover_image_url text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".project_styles (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES "${schema}".diy_projects(id) ON DELETE CASCADE,
      name jsonb NOT NULL,
      image_url text,
      price varchar(32),
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".party_packages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name jsonb NOT NULL,
      slug varchar(128) NOT NULL UNIQUE,
      description jsonb,
      includes jsonb NOT NULL DEFAULT '[]'::jsonb,
      cover_image_url text,
      image_urls text[] NOT NULL DEFAULT '{}',
      min_people integer NOT NULL,
      max_people integer NOT NULL,
      price_indicator varchar(128),
      guest_duration_minutes integer,
      setup_minutes integer,
      cleanup_minutes integer,
      venue_fee_cents integer,
      min_spend_per_person_cents integer,
      min_parents integer NOT NULL DEFAULT 1,
      max_parents integer NOT NULL DEFAULT 2,
      tags text[],
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".time_slots (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date date NOT NULL,
      start_time varchar(8) NOT NULL,
      end_time varchar(8) NOT NULL,
      capacity integer NOT NULL CHECK (capacity >= 1),
      booked_count integer NOT NULL DEFAULT 0
        CHECK (booked_count >= 0 AND booked_count <= capacity),
      category_id uuid REFERENCES "${schema}".project_categories(id),
      is_available boolean NOT NULL DEFAULT true,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".studio_weekly_hours (
      weekday integer PRIMARY KEY,
      opens_at varchar(5) NOT NULL,
      closes_at varchar(5) NOT NULL,
      is_closed boolean NOT NULL DEFAULT false
    );
    CREATE TABLE "${schema}".studio_special_hours (
      date date PRIMARY KEY,
      opens_at varchar(5),
      closes_at varchar(5),
      is_closed boolean NOT NULL DEFAULT false,
      note text
    );
    CREATE TABLE "${schema}".studio_closures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      date date NOT NULL,
      start_time varchar(5),
      end_time varchar(5),
      note text
    );
    CREATE TABLE "${schema}".bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      phone varchar(64) NOT NULL,
      wechat varchar(128),
      email varchar(255),
      preferred_date date,
      number_of_people integer,
      activity_type varchar(32),
      interested_project varchar(255),
      message text,
      locale varchar(8),
      time_slot_id uuid REFERENCES "${schema}".time_slots(id) ON DELETE RESTRICT,
      request_kind varchar(32) NOT NULL DEFAULT 'experience',
      project_id uuid REFERENCES "${schema}".diy_projects(id) ON DELETE RESTRICT,
      party_package_id uuid REFERENCES "${schema}".party_packages(id) ON DELETE RESTRICT,
      offering_name_snapshot jsonb,
      offering_price_snapshot varchar(128),
      slot_date date,
      slot_start_time varchar(8),
      slot_end_time varchar(8),
      slot_timezone varchar(64) NOT NULL DEFAULT 'Australia/Melbourne',
      idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      is_read boolean NOT NULL DEFAULT false,
      status varchar(32) NOT NULL DEFAULT 'pending_review',
      participant_count integer,
      young_child_count integer,
      accompanying_adult_count integer,
      attendance_count integer,
      duration_minutes integer,
      policy_version varchar(32),
      policy_accepted_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".booking_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL REFERENCES "${schema}".bookings(id) ON DELETE CASCADE,
      project_id uuid REFERENCES "${schema}".diy_projects(id) ON DELETE RESTRICT,
      project_name_snapshot jsonb,
      unit_price_cents_snapshot integer,
      duration_minutes_snapshot integer NOT NULL,
      quantity integer NOT NULL,
      decide_in_store boolean NOT NULL DEFAULT false,
      sort_order integer NOT NULL DEFAULT 0
    );
    CREATE TABLE "${schema}".customer_action_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid NOT NULL REFERENCES "${schema}".bookings(id) ON DELETE CASCADE,
      token_digest varchar(64) NOT NULL UNIQUE,
      scopes text[] NOT NULL,
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".cart_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name varchar(255) NOT NULL,
      phone varchar(64) NOT NULL,
      wechat varchar(128),
      email varchar(255),
      message text,
      time_slot_id uuid REFERENCES "${schema}".time_slots(id) ON DELETE RESTRICT,
      number_of_people integer,
      preferred_date date,
      slot_date date,
      slot_start_time varchar(8),
      slot_end_time varchar(8),
      slot_timezone varchar(64) NOT NULL DEFAULT 'Australia/Melbourne',
      locale varchar(8),
      idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      is_read boolean NOT NULL DEFAULT false,
      status varchar(32) NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".cart_order_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES "${schema}".cart_orders(id) ON DELETE CASCADE,
      project_id uuid REFERENCES "${schema}".diy_projects(id) ON DELETE SET NULL,
      style_id uuid REFERENCES "${schema}".project_styles(id) ON DELETE SET NULL,
      project_name jsonb,
      project_type varchar(32),
      style_name jsonb,
      date varchar(32),
      people integer,
      price varchar(32),
      price_currency varchar(10) NOT NULL DEFAULT 'AUD',
      sort_order integer NOT NULL DEFAULT 0
    );
    CREATE TABLE "${schema}".site_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      store_name varchar(255) NOT NULL DEFAULT '',
      address text,
      business_hours text,
      phone varchar(64),
      email varchar(255),
      wechat_id varchar(128),
      wechat_qr_url text,
      hero_image_url text,
      instagram text,
      xiaohongshu text,
      google_map_url text,
      seo_title text,
      seo_description text,
      experience_requests_enabled boolean NOT NULL DEFAULT false,
      party_requests_enabled boolean NOT NULL DEFAULT false,
      product_requests_enabled boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".request_status_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id uuid REFERENCES "${schema}".bookings(id) ON DELETE RESTRICT,
      cart_order_id uuid REFERENCES "${schema}".cart_orders(id) ON DELETE RESTRICT,
      operation_id uuid NOT NULL UNIQUE,
      from_status varchar(32) NOT NULL,
      to_status varchar(32) NOT NULL,
      admin_note text,
      actor_user_id uuid REFERENCES "${schema}".users(id) ON DELETE RESTRICT,
      actor_kind varchar(16) NOT NULL DEFAULT 'staff',
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (num_nonnulls(booking_id, cart_order_id) = 1)
    );
    CREATE TABLE "${schema}".email_outbox (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      dedupe_key varchar(255) NOT NULL UNIQUE,
      booking_id uuid REFERENCES "${schema}".bookings(id) ON DELETE RESTRICT,
      cart_order_id uuid REFERENCES "${schema}".cart_orders(id) ON DELETE RESTRICT,
      status_event_id uuid REFERENCES "${schema}".request_status_events(id) ON DELETE RESTRICT,
      message_type varchar(64) NOT NULL,
      recipient varchar(255) NOT NULL,
      locale varchar(8) NOT NULL,
      payload jsonb NOT NULL,
      delivery_status varchar(16) NOT NULL DEFAULT 'pending',
      attempt_count integer NOT NULL DEFAULT 0,
      next_attempt_at timestamptz NOT NULL DEFAULT now(),
      lease_expires_at timestamptz,
      provider_message_id varchar(255),
      last_error text,
      sent_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (num_nonnulls(booking_id, cart_order_id) = 1)
    );
    CREATE TABLE "${schema}".admin_request_reads (
      user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE CASCADE,
      booking_id uuid REFERENCES "${schema}".bookings(id) ON DELETE CASCADE,
      cart_order_id uuid REFERENCES "${schema}".cart_orders(id) ON DELETE CASCADE,
      read_at timestamptz NOT NULL DEFAULT now(),
      CHECK (num_nonnulls(booking_id, cart_order_id) = 1)
    );
    CREATE UNIQUE INDEX admin_request_reads_booking_unique
      ON "${schema}".admin_request_reads (user_id, booking_id)
      WHERE booking_id IS NOT NULL;
    CREATE UNIQUE INDEX admin_request_reads_cart_order_unique
      ON "${schema}".admin_request_reads (user_id, cart_order_id)
      WHERE cart_order_id IS NOT NULL
  `);
  const connection = createDb(withSearchPath(url, schema));
  return {
    schema,
    bootstrap,
    connection,
    async close() {
      await connection.client.end();
      await bootstrap.client.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await bootstrap.client.end();
    },
  };
}
