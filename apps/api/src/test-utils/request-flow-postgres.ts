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
      tags text[],
      sort_order integer NOT NULL DEFAULT 0,
      cover_image_url text,
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
      party_package_id uuid,
      offering_name_snapshot jsonb,
      offering_price_snapshot varchar(128),
      slot_date date,
      slot_start_time varchar(8),
      slot_end_time varchar(8),
      slot_timezone varchar(64) NOT NULL DEFAULT 'Australia/Melbourne',
      idempotency_key uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
      is_read boolean NOT NULL DEFAULT false,
      status varchar(32) NOT NULL DEFAULT 'new',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE "${schema}".cart_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid()
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
      actor_user_id uuid NOT NULL REFERENCES "${schema}".users(id) ON DELETE RESTRICT,
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
    )
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
