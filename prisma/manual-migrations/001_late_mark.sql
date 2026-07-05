-- Phase 1: Late-mark columns on attendance
-- Run this if you are NOT using `npx prisma migrate dev`.
ALTER TABLE `attendance`
  ADD COLUMN `isLate` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lateBy` INT NULL;
