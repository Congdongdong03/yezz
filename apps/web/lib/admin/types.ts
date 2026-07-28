export type LocalizedString = { en: string; zh: string };

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
};

export type LoginResponse = {
  user: AuthUser;
};

export type Category = {
  id: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  icon: string | null;
  sortOrder: number;
};

export type ProjectStyle = {
  id?: string;
  name: LocalizedString;
  imageUrl: string | null;
  price: string | null;
  sortOrder: number;
};

export type ProjectImage = {
  id?: string;
  url: string;
  sortOrder: number;
};

export type ProjectListItem = {
  id: string;
  name: LocalizedString;
  slug: string;
  projectType: "experience" | "product";
  description: LocalizedString | null;
  priceRange: string | null;
  duration: string | null;
  tags: string[] | null;
  sortOrder: number;
  coverImageUrl: string | null;
  category: {
    id: string;
    name: LocalizedString;
    slug: string;
    icon: string | null;
  };
};

export type ProjectDetail = ProjectListItem & {
  styles: ProjectStyle[];
  images: ProjectImage[];
};

export type AdminProjectsList = {
  items: ProjectListItem[];
  total: number;
  page?: number;
  limit?: number;
};

export type SiteSettings = {
  id: string;
  storeName: string;
  address: string | null;
  businessHours: string | null;
  phone: string | null;
  email: string | null;
  wechatId: string | null;
  wechatQrUrl: string | null;
  heroImageUrl: string | null;
  instagram: string | null;
  xiaohongshu: string | null;
  googleMapUrl: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
};

export type PartyPackage = {
  id: string;
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  includes: LocalizedString[];
  imageUrl: string | null;
  imageUrls: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string | null;
  tags: string[] | null;
  sortOrder: number;
};

export type PartyFormInput = {
  name: LocalizedString;
  slug: string;
  description: LocalizedString | null;
  includes: LocalizedString[];
  coverImageUrl: string | null;
  imageUrls: string[];
  minPeople: number;
  maxPeople: number;
  priceIndicator: string | null;
  tags: string[] | null;
  sortOrder: number;
};

export type GalleryImage = {
  id: string;
  imageUrl: string;
  category: string;
  caption: LocalizedString | null;
  sortOrder: number;
};

export type GalleryFormInput = {
  imageUrl: string;
  category: string;
  caption: LocalizedString | null;
  sortOrder: number;
};

export type UploadResult = {
  id: string;
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
};

export type OrderStatus = "new" | "contacted" | "confirmed" | "cancelled";

export type Booking = {
  id: string;
  kind: "experience" | "party";
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  activityType: string | null;
  interestedProject: string | null;
  message: string | null;
  locale: string | null;
  timeSlotId: string | null;
  status: OrderStatus;
  offering: {
    id: string | null;
    name: LocalizedString | null;
    price: string | null;
  } | null;
  slot: {
    id: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
  } | null;
  notificationSummary: {
    latestStatus: EmailDeliveryStatus | null;
    failedCount: number;
  };
  statusHistory: Array<{
    id: string;
    operationId: string;
    fromStatus: OrderStatus;
    toStatus: OrderStatus;
    note: string | null;
    createdAt: string;
    actor: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  emailDeliveries: Array<{
    id: string;
    messageType: string;
    recipient: string;
    deliveryStatus: EmailDeliveryStatus;
    attemptCount: number;
    lastError: string | null;
    sentAt: string | null;
    updatedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  replayed?: boolean;
  isUnread?: boolean;
};

export type BookingTransitionInput = {
  status: OrderStatus;
  expectedStatus: OrderStatus;
  operationId: string;
  note?: string;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "staff";
  createdAt: string;
};

export type PasswordChangeInput = {
  currentPassword: string;
  newPassword: string;
};

export type TimeSlot = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  remaining: number;
  categoryId: string | null;
  isAvailable: boolean;
  notes: string | null;
  almostFull: boolean;
};

export type UnreadCounts = {
  bookings: number;
  orders: number;
  total: number;
};

export type AdminQueueSummary = {
  unseen: UnreadCounts;
  new: number;
  contacted: number;
  overdue: number;
  confirmedToday: number;
  emailFailures: number;
};

export type AdminQueueListOptions = {
  page?: number;
  status?: OrderStatus;
  search?: string;
  unread?: boolean;
  overdue?: boolean;
  confirmedToday?: boolean;
};

export type EmailDeliveryStatus = "pending" | "processing" | "sent" | "failed";

export type EmailDelivery = {
  id: string;
  dedupeKey: string;
  bookingId: string | null;
  cartOrderId: string | null;
  statusEventId: string | null;
  messageType: string;
  recipient: string;
  locale: string;
  deliveryStatus: EmailDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string;
  leaseExpiresAt: string | null;
  providerMessageId: string | null;
  lastError: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmailDeliveryListOptions = {
  page?: number;
  limit?: number;
  status?: EmailDeliveryStatus;
};

export type EmailDeliveryList = {
  data: EmailDelivery[];
  total: number;
  page: number;
  limit: number;
};

export type CartOrderItem = {
  id: string;
  projectId: string | null;
  styleId: string | null;
  projectName: LocalizedString | string | null;
  projectType: "experience" | "product" | null;
  styleName: LocalizedString | string | null;
  date: string | null;
  people: number | null;
  price: string | null;
  priceCurrency: string;
  sortOrder: number;
};

export type CartOrder = {
  id: string;
  name: string;
  phone: string;
  wechat: string | null;
  email: string | null;
  message: string | null;
  preferredDate: string | null;
  numberOfPeople: number | null;
  locale: string | null;
  timeSlotId: string | null;
  slot: {
    id: string | null;
    date: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string;
  } | null;
  status: OrderStatus;
  items: CartOrderItem[];
  notificationSummary: {
    latestStatus: EmailDeliveryStatus | null;
    failedCount: number;
  };
  statusHistory: Booking["statusHistory"];
  emailDeliveries: Booking["emailDeliveries"];
  createdAt: string;
  updatedAt: string;
  replayed?: boolean;
  isUnread?: boolean;
};

export type CartOrderList = {
  data: CartOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
};

export type ProjectFormInput = {
  categoryId: string;
  name: LocalizedString;
  slug: string;
  projectType: "experience" | "product";
  description: LocalizedString | null;
  priceRange: string | null;
  duration: string | null;
  tags: string[] | null;
  sortOrder: number;
  coverImageUrl: string | null;
  styles: Array<{
    name: LocalizedString;
    imageUrl?: string | null;
    price?: string | null;
    sortOrder?: number;
  }>;
  images: Array<{ url: string; sortOrder?: number }>;
};
