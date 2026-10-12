-- Run once on the MySQL DB (or use `npx prisma db push`) — speeds up the Leads list with 5 lakh+ rows.
-- Safe to run on a live DB; each index builds online. Skip any that already exist.
CREATE INDEX leads_createdAt_idx ON leads (createdAt);
CREATE INDEX leads_updatedAt_idx ON leads (updatedAt);
CREATE INDEX leads_callbackDate_idx ON leads (callbackDate);
CREATE INDEX leads_clientPhone_idx ON leads (clientPhone);
CREATE INDEX leads_alternatePhone_idx ON leads (alternatePhone);
CREATE INDEX leads_clientEmail_idx ON leads (clientEmail);
CREATE INDEX leads_clientName_idx ON leads (clientName);
CREATE INDEX leads_companyName_idx ON leads (companyName);
CREATE INDEX leads_status_createdAt_idx ON leads (status, createdAt);
CREATE INDEX leads_assignedToId_createdAt_idx ON leads (assignedToId, createdAt);
CREATE INDEX leads_createdById_createdAt_idx ON leads (createdById, createdAt);
CREATE INDEX leads_meetingAssignedToId_meetingDate_idx ON leads (meetingAssignedToId, meetingDate);
