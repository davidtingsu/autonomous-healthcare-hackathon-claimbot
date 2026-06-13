import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  first_name: text("first_name").notNull(),
  last_name: text("last_name").notNull(),
  primary_id: uuid("primary_id"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const claimRequests = pgTable("claim_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id),
  claimed_amount: numeric("claimed_amount", { precision: 12, scale: 2 }).notNull(),
  service_date: date("service_date").notNull(),
  receipt_url: text("receipt_url"),
  receipt_extracted_patient_name: text("receipt_extracted_patient_name"),
  receipt_extracted_amount: numeric("receipt_extracted_amount", { precision: 12, scale: 2 }),
  receipt_extracted_date: date("receipt_extracted_date"),
  status: text("status").notNull(),
  graph_thread_id: text("graph_thread_id").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insuranceClaims = pgTable("insurance_claims", {
  id: uuid("id").primaryKey().defaultRandom(),
  claim_request_id: uuid("claim_request_id")
    .notNull()
    .unique()
    .references(() => claimRequests.id),
  claimed_amount: numeric("claimed_amount", { precision: 12, scale: 2 }).notNull(),
  service_date: date("service_date").notNull(),
  status: text("status").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const claimEvents = pgTable("claim_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  claim_request_id: uuid("claim_request_id")
    .notNull()
    .references(() => claimRequests.id),
  event_type: text("event_type").notNull(),
  actor_role: text("actor_role").notNull(),
  payload: jsonb("payload").notNull().default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id")
    .notNull()
    .references(() => users.id),
  claim_request_id: uuid("claim_request_id")
    .notNull()
    .references(() => claimRequests.id),
  type: text("type").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const langgraphCheckpoints = pgTable("langgraph_checkpoints", {
  thread_id: text("thread_id").primaryKey(),
  checkpoint: jsonb("checkpoint").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  claims: many(claimRequests),
  primary: one(users, {
    fields: [users.primary_id],
    references: [users.id],
    relationName: "dependents",
  }),
}));

export const claimRequestsRelations = relations(claimRequests, ({ one, many }) => ({
  users: one(users, {
    fields: [claimRequests.user_id],
    references: [users.id],
  }),
  events: many(claimEvents),
  insuranceClaims: many(insuranceClaims),
}));

export const insuranceClaimsRelations = relations(insuranceClaims, ({ one }) => ({
  claimRequest: one(claimRequests, {
    fields: [insuranceClaims.claim_request_id],
    references: [claimRequests.id],
  }),
}));

export const claimEventsRelations = relations(claimEvents, ({ one }) => ({
  claimRequest: one(claimRequests, {
    fields: [claimEvents.claim_request_id],
    references: [claimRequests.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.user_id],
    references: [users.id],
  }),
  claimRequest: one(claimRequests, {
    fields: [notifications.claim_request_id],
    references: [claimRequests.id],
  }),
}));
