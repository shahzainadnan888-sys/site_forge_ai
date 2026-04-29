declare namespace NodeJS {
  interface ProcessEnv {
    NEXT_PUBLIC_FIREBASE_API_KEY: string;
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: string;
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: string;
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: string;
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: string;
    NEXT_PUBLIC_FIREBASE_APP_ID: string;
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID?: string;
    NEXT_PUBLIC_GOOGLE_API_KEY?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    FIREBASE_PROJECT_ID?: string;
    FIREBASE_CLIENT_EMAIL?: string;
    FIREBASE_PRIVATE_KEY?: string;
    RESEND_API_KEY?: string;
    /** Canonical app URL (https://siteforgeai.com) for publish links when request host is wrong (e.g. some proxies). */
    NEXT_PUBLIC_APP_URL?: string;
    NEXT_PUBLIC_ROOT_URL?: string;
    /** Apex domain for subdomain links, e.g. siteforgeai.com (no path). */
    NEXT_PUBLIC_ROOT_DOMAIN?: string;
    FIREBASE_STORAGE_BUCKET?: string;
    LEMONSQUEEZY_WEBHOOK_SECRET?: string;
    /** Optional: mirror each publish to a Vercel static project (one project per siteId). */
    VERCEL_TOKEN?: string;
    /** Team scope; omit for Hobby / personal. */
    VERCEL_TEAM_ID?: string;
  }
}
