-- Desktop tracker (screenshot monitoring) + per-employee exemption flag.
-- Notification kill-switches (email_enabled / whatsapp_enabled) and all
-- tracker behavior settings (tracker_enabled, tracker_screenshots_per_day,
-- tracker_idle_threshold_seconds, tracker_screenshot_quality,
-- tracker_office_hours_only, tracker_retention_days) live in the existing
-- `settings` key-value table — no schema change needed for those, they're
-- created on first write via the Settings page.

ALTER TABLE `employees`
  ADD COLUMN `trackerExempt` BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE `tracker_sessions` (
  `id` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `checkInAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `checkOutAt` DATETIME(3) NULL,
  `idleSeconds` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE',
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE INDEX `tracker_sessions_employeeId_checkInAt_idx` ON `tracker_sessions`(`employeeId`, `checkInAt`);
CREATE INDEX `tracker_sessions_status_idx` ON `tracker_sessions`(`status`);

ALTER TABLE `tracker_sessions` ADD CONSTRAINT `tracker_sessions_employeeId_fkey`
  FOREIGN KEY (`employeeId`) REFERENCES `employees`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `tracker_screenshots` (
  `id` VARCHAR(191) NOT NULL,
  `sessionId` VARCHAR(191) NOT NULL,
  `employeeId` VARCHAR(191) NOT NULL,
  `url` TEXT NOT NULL,
  `publicId` VARCHAR(191) NULL,
  `capturedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4;

CREATE INDEX `tracker_screenshots_sessionId_idx` ON `tracker_screenshots`(`sessionId`);
CREATE INDEX `tracker_screenshots_employeeId_capturedAt_idx` ON `tracker_screenshots`(`employeeId`, `capturedAt`);

ALTER TABLE `tracker_screenshots` ADD CONSTRAINT `tracker_screenshots_sessionId_fkey`
  FOREIGN KEY (`sessionId`) REFERENCES `tracker_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;